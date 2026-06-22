package com.vikingstech.masterpdf.ui.tools

/**
 * Pure, dependency-free IO and validation specs for each tool: output MIME type,
 * suggested filename, accepted input MIME filters, whether a tool produces inline
 * text, whether it accepts multiple inputs, and whether it has enough input to
 * run. Kept out of the ViewModel so the mappings are unit-testable directly.
 */
object ToolIo {

    fun producesText(id: PdfToolId): Boolean =
        id == PdfToolId.EXTRACT_TXT || id == PdfToolId.OCR

    fun allowsMultiple(id: PdfToolId): Boolean =
        id == PdfToolId.MERGE || id == PdfToolId.IMAGE_TO_PDF

    fun outputMime(id: PdfToolId): String = when (id) {
        PdfToolId.PDF_TO_WORD -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        PdfToolId.PDF_TO_EXCEL -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        PdfToolId.PDF_TO_PPT, PdfToolId.PDF_TO_JPG -> "application/zip"
        PdfToolId.TO_JPG, PdfToolId.COMPRESS_IMAGE -> "image/jpeg"
        PdfToolId.FROM_JPG -> "image/png"
        PdfToolId.EXTRACT_TXT, PdfToolId.OCR -> "text/plain"
        else -> "application/pdf"
    }

    fun defaultFileName(id: PdfToolId): String = when (id) {
        PdfToolId.MERGE -> "merged.pdf"
        PdfToolId.SPLIT -> "split.pdf"
        PdfToolId.COMPRESS -> "compressed.pdf"
        PdfToolId.PDF_TO_WORD -> "document.docx"
        PdfToolId.PDF_TO_EXCEL -> "spreadsheet.xlsx"
        PdfToolId.PDF_TO_PPT -> "slides.zip"
        PdfToolId.WORD_TO_PDF, PdfToolId.PPT_TO_PDF, PdfToolId.EXCEL_TO_PDF -> "converted.pdf"
        PdfToolId.PDF_TO_JPG -> "pages.zip"
        PdfToolId.IMAGE_TO_PDF -> "images.pdf"
        PdfToolId.PAGE_NUMBERS -> "numbered.pdf"
        PdfToolId.WATERMARK -> "watermarked.pdf"
        PdfToolId.ROTATE -> "rotated.pdf"
        PdfToolId.UNLOCK -> "unlocked.pdf"
        PdfToolId.PROTECT -> "protected.pdf"
        PdfToolId.REPAIR -> "repaired.pdf"
        PdfToolId.CREATE -> "created.pdf"
        PdfToolId.COMPRESS_IMAGE -> "compressed.jpg"
        PdfToolId.TO_JPG -> "image.jpg"
        PdfToolId.FROM_JPG -> "image.png"
        PdfToolId.EXTRACT_TXT -> "extracted.txt"
        PdfToolId.OCR -> "ocr.txt"
        else -> "output.pdf"
    }

    fun inputMimeTypes(id: PdfToolId): Array<String> = when (id) {
        PdfToolId.IMAGE_TO_PDF, PdfToolId.COMPRESS_IMAGE, PdfToolId.TO_JPG, PdfToolId.FROM_JPG ->
            arrayOf("image/*")
        PdfToolId.WORD_TO_PDF ->
            arrayOf(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/msword", "text/plain", "application/rtf", "text/rtf"
            )
        PdfToolId.PPT_TO_PDF ->
            arrayOf(
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "application/vnd.ms-powerpoint"
            )
        PdfToolId.EXCEL_TO_PDF ->
            arrayOf(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-excel", "text/csv", "text/comma-separated-values"
            )
        else -> arrayOf("application/pdf")
    }

    /** Whether the tool has enough valid input/options to run. */
    fun canRun(
        id: PdfToolId,
        sourceCount: Int,
        password: String,
        createText: String,
        watermarkText: String
    ): Boolean = when (id) {
        PdfToolId.CREATE -> createText.isNotBlank()
        PdfToolId.MERGE -> sourceCount >= 2
        PdfToolId.PROTECT, PdfToolId.UNLOCK -> sourceCount >= 1 && password.isNotBlank()
        PdfToolId.WATERMARK -> sourceCount >= 1 && watermarkText.isNotBlank()
        else -> sourceCount >= 1
    }
}
