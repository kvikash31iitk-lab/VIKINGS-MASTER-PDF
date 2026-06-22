package com.vikingstech.masterpdf.data.repository

import android.content.Context
import android.net.Uri
import com.vikingstech.masterpdf.data.image.ImageEngine
import com.vikingstech.masterpdf.data.image.ImageFormat
import com.vikingstech.masterpdf.data.pdf.OcrEngine
import com.vikingstech.masterpdf.data.pdf.OfficeEngine
import com.vikingstech.masterpdf.data.pdf.OfficeKind
import com.vikingstech.masterpdf.data.pdf.PageNumberPosition
import com.vikingstech.masterpdf.data.pdf.PdfBoxManipulator
import com.vikingstech.masterpdf.data.pdf.PdfDocEngine
import com.vikingstech.masterpdf.data.pdf.TextExtractor
import com.vikingstech.masterpdf.di.IoDispatcher
import com.vikingstech.masterpdf.domain.model.ImageOutputFormat
import com.vikingstech.masterpdf.domain.model.OfficeFormat
import com.vikingstech.masterpdf.domain.model.PageNumberPlacement
import com.vikingstech.masterpdf.domain.repository.PdfToolsRepository
import com.vikingstech.masterpdf.domain.util.Resource
import com.vikingstech.masterpdf.ui.tools.PageRangeParser
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PdfToolsRepositoryImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    @IoDispatcher private val io: CoroutineDispatcher
) : PdfToolsRepository {

    override suspend fun merge(sources: List<String>, destination: String) = op {
        require(sources.size >= 2) { "Pick at least two PDFs to merge" }
        val temps = sources.mapIndexed { i, uri -> copyToTemp(uri, "merge_$i", "pdf") }
        val out = tempOut("pdf")
        try {
            PdfBoxManipulator.mergeDocuments(temps, out)
            deliver(out, destination)
        } finally {
            temps.forEach { it.delete() }
            out.delete()
        }
    }

    override suspend fun split(source: String, ranges: String, destination: String) = op {
        val src = copyToTemp(source, "split", "pdf")
        val out = tempOut("pdf")
        try {
            val count = PdfDocEngine.pageCount(src)
            val keep = PageRangeParser.parse(ranges, count)
            require(keep.isNotEmpty()) { "That range doesn't match any pages" }
            val drop = (0 until count).filter { it !in keep }
            if (drop.isEmpty()) {
                deliver(src, destination)
            } else {
                PdfBoxManipulator.deletePages(src, out, drop)
                deliver(out, destination)
            }
        } finally {
            src.delete(); out.delete()
        }
    }

    override suspend fun compress(source: String, quality: Float, destination: String) = op {
        transform(source, "pdf", destination) { src, out ->
            PdfBoxManipulator.compressImages(src, out, quality)
        }
    }

    override suspend fun rotateAll(source: String, degrees: Int, destination: String) = op {
        val src = copyToTemp(source, "rotate", "pdf")
        val out = tempOut("pdf")
        try {
            val count = PdfDocEngine.pageCount(src)
            PdfBoxManipulator.rotatePages(src, out, (0 until count).toList(), degrees)
            deliver(out, destination)
        } finally {
            src.delete(); out.delete()
        }
    }

    override suspend fun imagesToPdf(images: List<String>, destination: String) = op {
        require(images.isNotEmpty()) { "Pick at least one image" }
        val temps = images.mapIndexed { i, uri -> copyToTemp(uri, "img_$i", "img") }
        val out = tempOut("pdf")
        try {
            PdfDocEngine.imagesToPdf(temps, out)
            deliver(out, destination)
        } finally {
            temps.forEach { it.delete() }
            out.delete()
        }
    }

    override suspend fun pdfToImages(source: String, png: Boolean, quality: Int, destination: String) = op {
        val src = copyToTemp(source, "raster", "pdf")
        val dir = File(context.cacheDir, "pages_${System.nanoTime()}")
        val zip = tempOut("zip")
        try {
            val files = PdfDocEngine.pdfToImageFiles(src, dir, png, quality)
            require(files.isNotEmpty()) { "No pages could be rendered" }
            OfficeEngine.zipFiles(files, zip)
            deliver(zip, destination)
        } finally {
            src.delete(); zip.delete(); dir.deleteRecursively()
        }
    }

    override suspend fun addPageNumbers(
        source: String,
        placement: PageNumberPlacement,
        startAt: Int,
        fontSize: Float,
        destination: String
    ) = op {
        transform(source, "pdf", destination) { src, out ->
            PdfDocEngine.addPageNumbers(src, out, placement.toEngine(), startAt, fontSize)
        }
    }

    override suspend fun addWatermark(
        source: String,
        text: String,
        opacity: Float,
        rotation: Float,
        fontSize: Float,
        destination: String
    ) = op {
        transform(source, "pdf", destination) { src, out ->
            PdfDocEngine.addTextWatermark(src, out, text, opacity, rotation, fontSize)
        }
    }

    override suspend fun protect(source: String, password: String, destination: String) = op {
        transform(source, "pdf", destination) { src, out ->
            PdfDocEngine.protect(src, out, password)
        }
    }

    override suspend fun unlock(source: String, password: String, destination: String) = op {
        transform(source, "pdf", destination) { src, out ->
            PdfDocEngine.unlock(src, out, password)
        }
    }

    override suspend fun repair(source: String, destination: String) = op {
        transform(source, "pdf", destination) { src, out ->
            PdfDocEngine.repair(src, out)
        }
    }

    override suspend fun createPdfFromText(text: String, destination: String) = op {
        val out = tempOut("pdf")
        try {
            PdfDocEngine.textToPdf(text, out)
            deliver(out, destination)
        } finally {
            out.delete()
        }
    }

    override suspend fun pdfToWord(source: String, destination: String) = op {
        val src = copyToTemp(source, "topdf", "pdf")
        val out = tempOut("docx")
        try {
            val paragraphs = TextExtractor.extractAll(src).split("\n")
            OfficeEngine.writeDocx(paragraphs, out)
            deliver(out, destination)
        } finally {
            src.delete(); out.delete()
        }
    }

    override suspend fun pdfToExcel(source: String, destination: String) = op {
        val src = copyToTemp(source, "toxlsx", "pdf")
        val out = tempOut("xlsx")
        try {
            val rows = TextExtractor.extractAll(src)
                .split("\n")
                .map { line -> line.split(Regex("\\t|\\s{2,}")).map { it.trim() } }
            OfficeEngine.writeXlsx(rows, out)
            deliver(out, destination)
        } finally {
            src.delete(); out.delete()
        }
    }

    override suspend fun pdfToPowerpoint(source: String, destination: String) = op {
        val src = copyToTemp(source, "toppt", "pdf")
        val dir = File(context.cacheDir, "slides_${System.nanoTime()}")
        val zip = tempOut("zip")
        try {
            val files = PdfDocEngine.pdfToImageFiles(src, dir, png = true)
            require(files.isNotEmpty()) { "No slides could be rendered" }
            OfficeEngine.zipFiles(files, zip)
            deliver(zip, destination)
        } finally {
            src.delete(); zip.delete(); dir.deleteRecursively()
        }
    }

    override suspend fun officeToPdf(source: String, format: OfficeFormat, destination: String) = op {
        val src = copyToTemp(source, "office", "bin")
        val out = tempOut("pdf")
        try {
            val text = OfficeEngine.extractText(src, format.toEngine())
            require(text.isNotBlank()) {
                "No readable text found. Legacy .doc/.ppt/.xls files aren't supported — use the newer .docx/.pptx/.xlsx."
            }
            PdfDocEngine.textToPdf(text, out)
            deliver(out, destination)
        } finally {
            src.delete(); out.delete()
        }
    }

    override suspend fun extractText(source: String) = op {
        val src = copyToTemp(source, "extract", "pdf")
        try {
            TextExtractor.extractAll(src).ifBlank { "No embedded text was found in this PDF." }
        } finally {
            src.delete()
        }
    }

    override suspend fun ocr(source: String) = op {
        val src = copyToTemp(source, "ocr", "pdf")
        try {
            OcrEngine.recognize(src).ifBlank { "No text could be recognised." }
        } finally {
            src.delete()
        }
    }

    override suspend fun compressImage(source: String, quality: Int, destination: String) = op {
        val src = copyToTemp(source, "imgc", "img")
        val out = tempOut("jpg")
        try {
            ImageEngine.reencode(src, out, ImageFormat.JPEG, quality)
            deliver(out, destination)
        } finally {
            src.delete(); out.delete()
        }
    }

    override suspend fun convertImage(source: String, format: ImageOutputFormat, destination: String) = op {
        val engineFormat = if (format == ImageOutputFormat.PNG) ImageFormat.PNG else ImageFormat.JPEG
        val src = copyToTemp(source, "imgx", "img")
        val out = tempOut(engineFormat.extension)
        try {
            ImageEngine.reencode(src, out, engineFormat, 95)
            deliver(out, destination)
        } finally {
            src.delete(); out.delete()
        }
    }

    override suspend fun saveText(text: String, destination: String) = op {
        context.contentResolver.openOutputStream(Uri.parse(destination))?.use { os ->
            os.write(text.toByteArray(Charsets.UTF_8))
        } ?: error("Cannot open destination for writing")
        destination
    }

    // ── plumbing ───────────────────────────────────────────────────────────

    /** Run [block] on IO and wrap its result (or failure) in a [Resource]. */
    private suspend fun op(block: () -> String): Resource<String> = withContext(io) {
        runCatching { Resource.Success(block()) }
            .getOrElse { Resource.Error(it.message ?: "Operation failed", it) }
    }

    /** copy source → temp, run a File→File edit, stream result to destination. */
    private fun transform(source: String, suffix: String, destination: String, edit: (File, File) -> Unit): String {
        val src = copyToTemp(source, "in", suffix)
        val out = tempOut(suffix)
        try {
            edit(src, out)
            return deliver(out, destination)
        } finally {
            src.delete(); out.delete()
        }
    }

    private fun copyToTemp(uri: String, tag: String, suffix: String): File {
        val file = File(context.cacheDir, "${tag}_${System.nanoTime()}.$suffix")
        context.contentResolver.openInputStream(Uri.parse(uri))?.use { input ->
            file.outputStream().use { input.copyTo(it) }
        } ?: error("Cannot read the selected file")
        return file
    }

    private fun tempOut(suffix: String): File =
        File(context.cacheDir, "out_${System.nanoTime()}.$suffix")

    private fun deliver(file: File, destination: String): String {
        context.contentResolver.openOutputStream(Uri.parse(destination))?.use { os ->
            file.inputStream().use { it.copyTo(os) }
        } ?: error("Cannot open destination for writing")
        return destination
    }

    private fun PageNumberPlacement.toEngine(): PageNumberPosition = when (this) {
        PageNumberPlacement.BOTTOM_CENTER -> PageNumberPosition.BOTTOM_CENTER
        PageNumberPlacement.BOTTOM_RIGHT -> PageNumberPosition.BOTTOM_RIGHT
        PageNumberPlacement.TOP_CENTER -> PageNumberPosition.TOP_CENTER
        PageNumberPlacement.TOP_RIGHT -> PageNumberPosition.TOP_RIGHT
    }

    private fun OfficeFormat.toEngine(): OfficeKind = when (this) {
        OfficeFormat.WORD -> OfficeKind.WORD
        OfficeFormat.POWERPOINT -> OfficeKind.POWERPOINT
        OfficeFormat.EXCEL -> OfficeKind.EXCEL
    }
}
