package com.vikingstech.masterpdf.ui.tools

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ToolIoTest {

    @Test
    fun `output mime types are correct`() {
        assertEquals("application/pdf", ToolIo.outputMime(PdfToolId.MERGE))
        assertEquals(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ToolIo.outputMime(PdfToolId.PDF_TO_WORD)
        )
        assertEquals(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ToolIo.outputMime(PdfToolId.PDF_TO_EXCEL)
        )
        assertEquals("application/zip", ToolIo.outputMime(PdfToolId.PDF_TO_PPT))
        assertEquals("application/zip", ToolIo.outputMime(PdfToolId.PDF_TO_JPG))
        assertEquals("image/jpeg", ToolIo.outputMime(PdfToolId.TO_JPG))
        assertEquals("image/jpeg", ToolIo.outputMime(PdfToolId.COMPRESS_IMAGE))
        assertEquals("image/png", ToolIo.outputMime(PdfToolId.FROM_JPG))
        assertEquals("text/plain", ToolIo.outputMime(PdfToolId.EXTRACT_TXT))
        assertEquals("text/plain", ToolIo.outputMime(PdfToolId.OCR))
    }

    @Test
    fun `default filename extension matches the format`() {
        fun ext(id: PdfToolId) = ToolIo.defaultFileName(id).substringAfterLast('.')
        assertEquals("pdf", ext(PdfToolId.MERGE))
        assertEquals("docx", ext(PdfToolId.PDF_TO_WORD))
        assertEquals("xlsx", ext(PdfToolId.PDF_TO_EXCEL))
        assertEquals("zip", ext(PdfToolId.PDF_TO_PPT))
        assertEquals("zip", ext(PdfToolId.PDF_TO_JPG))
        assertEquals("jpg", ext(PdfToolId.TO_JPG))
        assertEquals("png", ext(PdfToolId.FROM_JPG))
        assertEquals("txt", ext(PdfToolId.EXTRACT_TXT))
        assertEquals("pdf", ext(PdfToolId.WORD_TO_PDF))
    }

    @Test
    fun `every tool has a non-blank mime and a filename with an extension`() {
        PdfToolId.values().forEach { id ->
            assertTrue("mime for $id", ToolIo.outputMime(id).isNotBlank())
            assertTrue("filename ext for $id", ToolIo.defaultFileName(id).contains('.'))
            assertTrue("input mimes for $id", ToolIo.inputMimeTypes(id).isNotEmpty())
        }
    }

    @Test
    fun `producesText only for extract and ocr`() {
        assertTrue(ToolIo.producesText(PdfToolId.EXTRACT_TXT))
        assertTrue(ToolIo.producesText(PdfToolId.OCR))
        assertFalse(ToolIo.producesText(PdfToolId.MERGE))
        assertFalse(ToolIo.producesText(PdfToolId.COMPRESS))
    }

    @Test
    fun `allowsMultiple only for merge and image to pdf`() {
        assertTrue(ToolIo.allowsMultiple(PdfToolId.MERGE))
        assertTrue(ToolIo.allowsMultiple(PdfToolId.IMAGE_TO_PDF))
        assertFalse(ToolIo.allowsMultiple(PdfToolId.SPLIT))
        assertFalse(ToolIo.allowsMultiple(PdfToolId.COMPRESS_IMAGE))
    }

    @Test
    fun `create requires text`() {
        assertFalse(ToolIo.canRun(PdfToolId.CREATE, sourceCount = 0, password = "", createText = "", watermarkText = ""))
        assertTrue(ToolIo.canRun(PdfToolId.CREATE, sourceCount = 0, password = "", createText = "Hello", watermarkText = ""))
    }

    @Test
    fun `merge requires at least two sources`() {
        assertFalse(ToolIo.canRun(PdfToolId.MERGE, 1, "", "", ""))
        assertTrue(ToolIo.canRun(PdfToolId.MERGE, 2, "", "", ""))
    }

    @Test
    fun `protect and unlock require a password`() {
        assertFalse(ToolIo.canRun(PdfToolId.PROTECT, 1, "", "", ""))
        assertTrue(ToolIo.canRun(PdfToolId.PROTECT, 1, "secret", "", ""))
        assertFalse(ToolIo.canRun(PdfToolId.UNLOCK, 1, "", "", ""))
        assertTrue(ToolIo.canRun(PdfToolId.UNLOCK, 1, "secret", "", ""))
    }

    @Test
    fun `watermark requires text`() {
        assertFalse(ToolIo.canRun(PdfToolId.WATERMARK, 1, "", "", ""))
        assertTrue(ToolIo.canRun(PdfToolId.WATERMARK, 1, "", "", "DRAFT"))
    }

    @Test
    fun `generic tools just require a source`() {
        assertFalse(ToolIo.canRun(PdfToolId.COMPRESS, 0, "", "", ""))
        assertTrue(ToolIo.canRun(PdfToolId.COMPRESS, 1, "", "", ""))
        assertFalse(ToolIo.canRun(PdfToolId.PDF_TO_JPG, 0, "", "", ""))
        assertTrue(ToolIo.canRun(PdfToolId.PDF_TO_JPG, 1, "", "", ""))
    }
}
