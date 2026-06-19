package com.vikingstech.masterpdf.data.pdf

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.toArgb
import com.tom_roush.pdfbox.cos.COSName
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.multipdf.PDFMergerUtility
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.font.PDType1Font
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory
import com.tom_roush.pdfbox.pdmodel.graphics.image.LosslessFactory
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDCheckBox
import com.vikingstech.masterpdf.domain.model.InkAnnotation
import java.io.File

/**
 * Structural page operations backed by PdfBox-Android. Every operation reads
 * [source], mutates in a temp-file-backed PDDocument, and writes a fresh
 * [destination] file so the original is never corrupted on a failed save.
 */
object PdfBoxManipulator {

    fun reorderPages(source: File, destination: File, newOrder: List<Int>) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            val tree = doc.pages
            val current = tree.toList()
            require(newOrder.sorted() == current.indices.toList()) {
                "newOrder must be a permutation of the page indices"
            }
            val reordered = newOrder.map { current[it] }
            current.forEach { tree.remove(it) }
            reordered.forEach { tree.add(it) }
            doc.save(destination)
        }
    }

    fun deletePages(source: File, destination: File, pageIndices: List<Int>) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            val valid = pageIndices.distinct().filter { it in 0 until doc.numberOfPages }
            require(doc.numberOfPages - valid.size >= 1) {
                "A PDF must keep at least one page."
            }
            // Remove from the back so earlier indices stay valid.
            valid.sortedDescending().forEach { idx -> doc.removePage(idx) }
            doc.save(destination)
        }
    }

    fun rotatePages(source: File, destination: File, pageIndices: List<Int>, degrees: Int) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            pageIndices.distinct().forEach { idx ->
                if (idx in 0 until doc.numberOfPages) {
                    val page = doc.getPage(idx)
                    page.rotation = ((page.rotation + degrees) % 360 + 360) % 360
                }
            }
            doc.save(destination)
        }
    }

    fun fillFormField(source: File, destination: File, fieldName: String, value: String) {
        fillFormFields(source, destination, mapOf(fieldName to value))
    }

    /**
     * Applies multiple field values in a single pass. Checkboxes use the
     * dedicated check/unCheck APIs (their on-state names vary per document and
     * a hardcoded "Yes"/"No" often fails); every other field type is set by its
     * export value. Failures on a single field are isolated so one bad value
     * never aborts the whole save.
     */
    fun fillFormFields(source: File, destination: File, values: Map<String, String>) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            val acroForm = doc.documentCatalog.acroForm
            if (acroForm != null) {
                values.forEach { (name, value) ->
                    runCatching {
                        when (val field = acroForm.getField(name)) {
                            null -> Unit
                            is PDCheckBox -> {
                                if (isCheckedValue(value)) field.check() else field.unCheck()
                            }
                            else -> field.setValue(value)
                        }
                    }
                }
            }
            doc.save(destination)
        }
    }

    private fun isCheckedValue(value: String): Boolean = when {
        value.isBlank() -> false
        value.equals("off", ignoreCase = true) -> false
        value.equals("no", ignoreCase = true) -> false
        value.equals("false", ignoreCase = true) -> false
        value == "0" -> false
        else -> true
    }

    /**
     * Draws freehand strokes onto a page as vector polylines via a content stream.
     * (pdfbox-android doesn't ship a dedicated ink-annotation type, and painting
     * the strokes directly renders identically and is simpler to reason about.)
     *
     * Stroke points are expected to already be in PDF user-space (bottom-left
     * origin, points) — the caller maps from screen/normalized coordinates. Each
     * stroke is painted with its own colour and width.
     */
    fun addInkAnnotation(source: File, destination: File, annotation: InkAnnotation) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            if (annotation.pageIndex !in 0 until doc.numberOfPages) return@use
            val page = doc.getPage(annotation.pageIndex)

            PDPageContentStream(
                doc, page, PDPageContentStream.AppendMode.APPEND, true, true
            ).use { cs ->
                for (stroke in annotation.strokes) {
                    val pts = stroke.points
                    if (pts.size < 2) continue
                    val argb = stroke.color.toArgb()
                    cs.setStrokingColor(
                        ((argb shr 16) and 0xFF) / 255f,
                        ((argb shr 8) and 0xFF) / 255f,
                        (argb and 0xFF) / 255f
                    )
                    cs.setLineWidth(stroke.strokeWidth.coerceAtLeast(0.5f))
                    cs.moveTo(pts[0].x, pts[0].y)
                    for (i in 1 until pts.size) {
                        cs.lineTo(pts[i].x, pts[i].y)
                    }
                    cs.stroke()
                }
            }
            doc.save(destination)
        }
    }

    /**
     * Draws a text stamp (a filled, bordered rectangle with centred text) onto
     * [pageIndex] at the given rectangle, expressed in PDF user-space points with
     * a bottom-left origin. Colours are packed ARGB ints. The font size is scaled
     * down if the text would overflow the box width.
     */
    fun addTextStamp(
        source: File,
        destination: File,
        pageIndex: Int,
        text: String,
        textArgb: Int,
        backgroundArgb: Int,
        borderArgb: Int,
        borderWidthPts: Float,
        fontSizePts: Float,
        xPts: Float,
        yPts: Float,
        widthPts: Float,
        heightPts: Float
    ) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            if (pageIndex !in 0 until doc.numberOfPages) return@use
            val page = doc.getPage(pageIndex)
            val font = PDType1Font.HELVETICA_BOLD

            PDPageContentStream(
                doc, page, PDPageContentStream.AppendMode.APPEND, true, true
            ).use { cs ->
                // Background fill.
                setNonStrokingArgb(cs, backgroundArgb)
                cs.addRect(xPts, yPts, widthPts, heightPts)
                cs.fill()

                // Border.
                if (borderWidthPts > 0f) {
                    setStrokingArgb(cs, borderArgb)
                    cs.setLineWidth(borderWidthPts)
                    cs.addRect(xPts, yPts, widthPts, heightPts)
                    cs.stroke()
                }

                // Centred text, shrunk to fit the available width.
                if (text.isNotEmpty()) {
                    val padding = 4f
                    val available = (widthPts - padding * 2).coerceAtLeast(1f)
                    var size = fontSizePts.coerceAtLeast(1f)
                    var textWidth = font.getStringWidth(text) / 1000f * size
                    if (textWidth > available) {
                        size *= available / textWidth
                        textWidth = available
                    }
                    val textHeight = font.fontDescriptor.capHeight / 1000f * size
                    val tx = xPts + (widthPts - textWidth) / 2f
                    val ty = yPts + (heightPts - textHeight) / 2f
                    setNonStrokingArgb(cs, textArgb)
                    cs.beginText()
                    cs.setFont(font, size)
                    cs.newLineAtOffset(tx, ty)
                    cs.showText(text)
                    cs.endText()
                }
            }
            doc.save(destination)
        }
    }

    private fun setNonStrokingArgb(cs: PDPageContentStream, argb: Int) {
        cs.setNonStrokingColor(
            ((argb shr 16) and 0xFF) / 255f,
            ((argb shr 8) and 0xFF) / 255f,
            (argb and 0xFF) / 255f
        )
    }

    private fun setStrokingArgb(cs: PDPageContentStream, argb: Int) {
        cs.setStrokingColor(
            ((argb shr 16) and 0xFF) / 255f,
            ((argb shr 8) and 0xFF) / 255f,
            (argb and 0xFF) / 255f
        )
    }

    /**
     * Merges [sources] (in order) into a single [destination] PDF. Uses a
     * temp-file-only memory setting so very large inputs never sit fully on-heap.
     */
    fun mergeDocuments(sources: List<File>, destination: File) {
        require(sources.isNotEmpty()) { "At least one source document is required" }
        val merger = PDFMergerUtility().apply {
            destinationFileName = destination.absolutePath
            sources.forEach { addSource(it) }
        }
        merger.mergeDocuments(MemoryUsageSetting.setupTempFileOnly())
    }

    /**
     * Re-encodes every embedded raster image at the given JPEG [quality] (0..1),
     * shrinking the file. Each image is handled defensively: a failure on one
     * image is skipped rather than aborting the whole operation.
     */
    fun compressImages(source: File, destination: File, quality: Float) {
        val q = quality.coerceIn(0.1f, 1f)
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            for (page in doc.pages) {
                val resources = page.resources ?: continue
                // Snapshot names first; we mutate the resource dictionary in the loop.
                val names = resources.xObjectNames?.toList() ?: continue
                for (name in names) {
                    runCatching {
                        val xObject = resources.getXObject(name)
                        if (xObject is PDImageXObject) {
                            val bitmap: Bitmap = xObject.image ?: return@runCatching
                            val recompressed = JPEGFactory.createFromImage(doc, bitmap, q)
                            resources.put(name as COSName, recompressed)
                        }
                    }
                }
            }
            doc.save(destination)
        }
    }

    /**
     * Stamps a raster image (e.g. a signature PNG) onto [pageIndex] at the given
     * rectangle, expressed in PDF user-space points with a bottom-left origin.
     * Transparency is preserved via the lossless image factory.
     */
    fun addImageAnnotation(
        source: File,
        destination: File,
        pageIndex: Int,
        imageBytes: ByteArray,
        xPts: Float,
        yPts: Float,
        widthPts: Float,
        heightPts: Float
    ) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            if (pageIndex !in 0 until doc.numberOfPages) return@use
            val page = doc.getPage(pageIndex)
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                ?: return@use
            val image: PDImageXObject = LosslessFactory.createFromImage(doc, bitmap)
            PDPageContentStream(
                doc,
                page,
                PDPageContentStream.AppendMode.APPEND,
                true,
                true
            ).use { stream ->
                stream.drawImage(image, xPts, yPts, widthPts, heightPts)
            }
            doc.save(destination)
        }
    }
}
