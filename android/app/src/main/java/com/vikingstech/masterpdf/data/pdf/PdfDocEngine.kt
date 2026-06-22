package com.vikingstech.masterpdf.data.pdf

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import com.vikingstech.masterpdf.data.image.ImageDecoder
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle
import com.tom_roush.pdfbox.pdmodel.encryption.AccessPermission
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException
import com.tom_roush.pdfbox.pdmodel.encryption.StandardProtectionPolicy
import com.tom_roush.pdfbox.pdmodel.font.PDType1Font
import com.tom_roush.pdfbox.pdmodel.graphics.image.LosslessFactory
import com.tom_roush.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState
import com.tom_roush.pdfbox.util.Matrix
import java.io.File
import kotlin.math.min

/** Where a stamped page number sits on the page. */
enum class PageNumberPosition { BOTTOM_CENTER, BOTTOM_RIGHT, TOP_CENTER, TOP_RIGHT }

/**
 * New structural / generative PDF operations layered on PdfBox-Android, kept
 * separate from [PdfBoxManipulator] (the pre-existing edit ops). Everything is
 * File→File so the URI plumbing lives in the repository and these stay testable
 * in isolation. Page rasterisation uses the platform [PdfRenderer] (hardware
 * accelerated, on-demand) rather than PdfBox so large documents don't OOM.
 */
object PdfDocEngine {

    private const val MARGIN = 48f
    private val A4 = PDRectangle.A4

    // ── creation ───────────────────────────────────────────────────────────

    /** One image per A4 page, scaled to fit and centred. */
    fun imagesToPdf(images: List<File>, destination: File) {
        require(images.isNotEmpty()) { "Pick at least one image" }
        PDDocument().use { doc ->
            var added = 0
            for (file in images) {
                val bmp = runCatching { ImageDecoder.load(file) }.getOrNull() ?: continue
                val page = PDPage(A4)
                doc.addPage(page)
                val image = LosslessFactory.createFromImage(doc, bmp)
                val maxW = A4.width - MARGIN
                val maxH = A4.height - MARGIN
                val ratio = min(maxW / bmp.width, maxH / bmp.height)
                val w = bmp.width * ratio
                val h = bmp.height * ratio
                val x = (A4.width - w) / 2f
                val y = (A4.height - h) / 2f
                PDPageContentStream(doc, page).use { cs -> cs.drawImage(image, x, y, w, h) }
                bmp.recycle()
                added++
            }
            require(added > 0) { "None of the selected images could be read" }
            doc.save(destination)
        }
    }

    /** Render plain text into paginated A4 pages with simple word wrapping. */
    fun textToPdf(text: String, destination: File, fontSize: Float = 11f) {
        val font = PDType1Font.HELVETICA
        val leading = fontSize * 1.4f
        val usableWidth = A4.width - MARGIN * 2
        val lines = wrapText(text.ifBlank { " " }, font, fontSize, usableWidth)

        PDDocument().use { doc ->
            var page = PDPage(A4).also { doc.addPage(it) }
            var cs = PDPageContentStream(doc, page)
            var y = A4.height - MARGIN
            cs.beginText()
            cs.setFont(font, fontSize)
            cs.newLineAtOffset(MARGIN, y)
            for (line in lines) {
                if (y <= MARGIN) {
                    cs.endText()
                    cs.close()
                    page = PDPage(A4).also { doc.addPage(it) }
                    cs = PDPageContentStream(doc, page)
                    y = A4.height - MARGIN
                    cs.beginText()
                    cs.setFont(font, fontSize)
                    cs.newLineAtOffset(MARGIN, y)
                }
                runCatching { cs.showText(line) }
                cs.newLineAtOffset(0f, -leading)
                y -= leading
            }
            cs.endText()
            cs.close()
            doc.save(destination)
        }
    }

    // ── rasterisation ────────────────────────────────────────────────────────

    /**
     * Render every page to a bitmap file in [outDir]; returns the files in page
     * order. [png] picks PNG over JPEG; [quality] (0..100) applies to JPEG.
     */
    fun pdfToImageFiles(
        source: File,
        outDir: File,
        png: Boolean,
        quality: Int = 85,
        targetWidth: Int = 1240
    ): List<File> {
        outDir.mkdirs()
        val out = mutableListOf<File>()
        ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
            PdfRenderer(pfd).use { renderer ->
                for (i in 0 until renderer.pageCount) {
                    renderer.openPage(i).use { page ->
                        val aspect = if (page.width == 0) 1f else page.height.toFloat() / page.width
                        val w = targetWidth
                        val h = (targetWidth * aspect).toInt().coerceAtLeast(1)
                        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                        bmp.eraseColor(android.graphics.Color.WHITE)
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
                        val ext = if (png) "png" else "jpg"
                        val file = File(outDir, "page_${i + 1}.$ext")
                        file.outputStream().use { os ->
                            if (png) {
                                bmp.compress(Bitmap.CompressFormat.PNG, 100, os)
                            } else {
                                bmp.compress(Bitmap.CompressFormat.JPEG, quality.coerceIn(1, 100), os)
                            }
                        }
                        bmp.recycle()
                        out += file
                    }
                }
            }
        }
        return out
    }

    /** Page count via the platform renderer (used to drive PDF→office exports). */
    fun pageCount(source: File): Int =
        ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
            PdfRenderer(pfd).use { it.pageCount }
        }

    // ── stamping ───────────────────────────────────────────────────────────

    fun addPageNumbers(
        source: File,
        destination: File,
        position: PageNumberPosition,
        startAt: Int,
        fontSize: Float
    ) {
        val font = PDType1Font.HELVETICA
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            doc.pages.forEachIndexed { index, page ->
                val box = page.mediaBox
                val label = (startAt + index).toString()
                val textWidth = font.getStringWidth(label) / 1000f * fontSize
                val (x, y) = when (position) {
                    PageNumberPosition.BOTTOM_CENTER -> (box.width - textWidth) / 2f to MARGIN / 2f
                    PageNumberPosition.BOTTOM_RIGHT -> box.width - MARGIN - textWidth to MARGIN / 2f
                    PageNumberPosition.TOP_CENTER -> (box.width - textWidth) / 2f to box.height - MARGIN / 2f
                    PageNumberPosition.TOP_RIGHT -> box.width - MARGIN - textWidth to box.height - MARGIN / 2f
                }
                PDPageContentStream(
                    doc, page, PDPageContentStream.AppendMode.APPEND, true, true
                ).use { cs ->
                    cs.beginText()
                    cs.setFont(font, fontSize)
                    cs.newLineAtOffset(x, y)
                    runCatching { cs.showText(label) }
                    cs.endText()
                }
            }
            doc.save(destination)
        }
    }

    /** Diagonal, semi-transparent grey text watermark across every page. */
    fun addTextWatermark(
        source: File,
        destination: File,
        text: String,
        opacity: Float,
        rotationDeg: Float,
        fontSize: Float
    ) {
        val font = PDType1Font.HELVETICA_BOLD
        val safeText = sanitize(text).ifBlank { "WATERMARK" }
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            val gs = PDExtendedGraphicsState().apply {
                setNonStrokingAlphaConstant(opacity.coerceIn(0.05f, 1f))
            }
            doc.pages.forEach { page ->
                val box = page.mediaBox
                val textWidth = font.getStringWidth(safeText) / 1000f * fontSize
                val cx = box.width / 2f - textWidth / 2f
                val cy = box.height / 2f
                PDPageContentStream(
                    doc, page, PDPageContentStream.AppendMode.APPEND, true, true
                ).use { cs ->
                    cs.setGraphicsStateParameters(gs)
                    cs.setNonStrokingColor(0.5f, 0.5f, 0.5f)
                    cs.beginText()
                    cs.setFont(font, fontSize)
                    cs.setTextMatrix(Matrix.getRotateInstance(Math.toRadians(rotationDeg.toDouble()), cx, cy))
                    runCatching { cs.showText(safeText) }
                    cs.endText()
                }
            }
            doc.save(destination)
        }
    }

    // ── security ───────────────────────────────────────────────────────────

    fun protect(source: File, destination: File, password: String) {
        require(password.isNotBlank()) { "Enter a password" }
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            val permissions = AccessPermission()
            val policy = StandardProtectionPolicy(password, password, permissions).apply {
                setEncryptionKeyLength(128)
                setPermissions(permissions)
            }
            doc.protect(policy)
            doc.save(destination)
        }
    }

    fun unlock(source: File, destination: File, password: String) {
        val doc = try {
            PDDocument.load(source, password, MemoryUsageSetting.setupTempFileOnly())
        } catch (e: InvalidPasswordException) {
            throw IllegalStateException("Incorrect password — could not unlock this PDF.", e)
        }
        doc.use {
            it.setAllSecurityToBeRemoved(true)
            it.save(destination)
        }
    }

    /** Re-parse and re-save; PdfBox rebuilds the cross-reference table. */
    fun repair(source: File, destination: File) {
        val doc = try {
            PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly())
        } catch (e: Exception) {
            throw IllegalStateException("This PDF is too damaged to repair.", e)
        }
        doc.use { it.save(destination) }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private fun wrapText(text: String, font: PDType1Font, size: Float, maxWidth: Float): List<String> {
        val out = mutableListOf<String>()
        for (rawLine in text.split("\n")) {
            val line = sanitize(rawLine)
            if (line.isEmpty()) {
                out += ""
                continue
            }
            var current = StringBuilder()
            for (word in line.split(" ")) {
                val candidate = if (current.isEmpty()) word else "$current $word"
                val width = runCatching { font.getStringWidth(candidate) / 1000f * size }.getOrDefault(0f)
                if (width > maxWidth && current.isNotEmpty()) {
                    out += current.toString()
                    current = StringBuilder(word)
                } else {
                    current = StringBuilder(candidate)
                }
            }
            out += current.toString()
        }
        return out
    }

    /** Keep only WinAnsi-printable characters so PDType1 fonts never throw. */
    private fun sanitize(s: String): String = buildString {
        for (c in s) {
            when {
                c == '\t' -> append("    ")
                c.code in 32..255 -> append(c)
                else -> append('?')
            }
        }
    }
}
