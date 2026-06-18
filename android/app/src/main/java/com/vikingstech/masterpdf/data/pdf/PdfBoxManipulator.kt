package com.vikingstech.masterpdf.data.pdf

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.toArgb
import com.tom_roush.pdfbox.cos.COSName
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.multipdf.PDFMergerUtility
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle
import com.tom_roush.pdfbox.pdmodel.graphics.color.PDColor
import com.tom_roush.pdfbox.pdmodel.graphics.color.PDDeviceRGB
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory
import com.tom_roush.pdfbox.pdmodel.graphics.image.LosslessFactory
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject
import com.tom_roush.pdfbox.pdmodel.interactive.annotation.PDAnnotationInk
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
            // Remove from the back so earlier indices stay valid.
            pageIndices.distinct().sortedDescending().forEach { idx ->
                if (idx in 0 until doc.numberOfPages) doc.removePage(idx)
            }
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
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            val acroForm = doc.documentCatalog.acroForm
            if (acroForm != null) {
                val field = acroForm.getField(fieldName)
                if (field != null) {
                    field.value = value
                }
            }
            doc.save(destination)
        }
    }

    fun addInkAnnotation(source: File, destination: File, annotation: InkAnnotation) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            if (annotation.pageIndex !in 0 until doc.numberOfPages) return@use

            val page = doc.getPage(annotation.pageIndex)
            val inkAnnotation = PDAnnotationInk()

            for (stroke in annotation.strokes) {
                val quadPoints = mutableListOf<Float>()
                var minX = Float.MAX_VALUE
                var maxX = Float.MIN_VALUE
                var minY = Float.MAX_VALUE
                var maxY = Float.MIN_VALUE

                for (point in stroke.points) {
                    quadPoints.add(point.x)
                    quadPoints.add(point.y)
                    minX = minOf(minX, point.x)
                    maxX = maxOf(maxX, point.x)
                    minY = minOf(minY, point.y)
                    maxY = maxOf(maxY, point.y)
                }

                if (quadPoints.isNotEmpty()) {
                    val list = mutableListOf<FloatArray>()
                    for (i in 0 until quadPoints.size step 2) {
                        list.add(floatArrayOf(quadPoints[i], quadPoints[i + 1]))
                    }
                    inkAnnotation.inkList = listOf(list)
                }
            }

            val color = annotation.strokes.firstOrNull()?.color
            if (color != null) {
                val argb = color.toArgb()
                val r = ((argb shr 16) and 0xFF) / 255f
                val g = ((argb shr 8) and 0xFF) / 255f
                val b = (argb and 0xFF) / 255f
                inkAnnotation.color = PDColor(floatArrayOf(r, g, b), PDDeviceRGB.INSTANCE)
            }

            val stroke = annotation.strokes.firstOrNull()
            if (stroke != null) {
                inkAnnotation.borderStyle.width = stroke.strokeWidth
            }

            var minX = Float.MAX_VALUE
            var maxX = Float.MIN_VALUE
            var minY = Float.MAX_VALUE
            var maxY = Float.MIN_VALUE

            for (stroke in annotation.strokes) {
                for (point in stroke.points) {
                    minX = minOf(minX, point.x)
                    maxX = maxOf(maxX, point.x)
                    minY = minOf(minY, point.y)
                    maxY = maxOf(maxY, point.y)
                }
            }

            if (minX != Float.MAX_VALUE && maxX != Float.MIN_VALUE) {
                val rect = PDRectangle(minX, minY, maxX - minX, maxY - minY)
                inkAnnotation.rectangle = rect
            }

            page.annotations.add(inkAnnotation)
            doc.save(destination)
        }
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
