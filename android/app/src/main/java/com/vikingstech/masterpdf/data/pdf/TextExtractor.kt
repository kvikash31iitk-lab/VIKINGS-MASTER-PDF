package com.vikingstech.masterpdf.data.pdf

import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.File

/**
 * Extracts the embedded text layer of a single page via PdfBox. Loads with a
 * temp-file-only memory setting so even very large documents stay off-heap.
 */
object TextExtractor {
    fun extractPage(file: File, pageIndex: Int): String =
        PDDocument.load(file, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            val stripper = PDFTextStripper().apply {
                startPage = pageIndex + 1
                endPage = pageIndex + 1
            }
            stripper.getText(doc).trim()
        }

    /** Extracts the embedded text layer of the whole document in page order. */
    fun extractAll(file: File): String =
        PDDocument.load(file, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            PDFTextStripper().getText(doc).trim()
        }
}
