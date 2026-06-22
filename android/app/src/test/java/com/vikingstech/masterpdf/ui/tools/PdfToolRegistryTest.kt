package com.vikingstech.masterpdf.ui.tools

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PdfToolRegistryTest {

    @Test
    fun `registry contains all 26 tools`() {
        assertEquals(26, PdfToolRegistry.tools.size)
    }

    @Test
    fun `every tool id is represented exactly once - nothing hidden`() {
        val ids = PdfToolRegistry.tools.map { it.id }
        assertEquals(PdfToolId.values().size, ids.size)
        assertEquals(PdfToolId.values().toSet(), ids.toSet())
        assertEquals("ids must be unique", ids.size, ids.toSet().size)
    }

    @Test
    fun `categories split into 23 PDF and 3 image tools`() {
        assertEquals(23, PdfToolRegistry.byCategory(ToolCategory.PDF).size)
        assertEquals(3, PdfToolRegistry.byCategory(ToolCategory.IMAGE).size)
    }

    @Test
    fun `every tool has a title, description and search terms`() {
        PdfToolRegistry.tools.forEach { tool ->
            assertTrue("title res", tool.titleRes != 0)
            assertTrue("desc res", tool.descriptionRes != 0)
            assertTrue("search terms for ${tool.id}", tool.searchTerms.isNotBlank())
        }
    }

    @Test
    fun `blank query returns every tool`() {
        assertEquals(PdfToolRegistry.tools.size, PdfToolRegistry.search("").size)
        assertEquals(PdfToolRegistry.tools.size, PdfToolRegistry.search("   ").size)
    }

    @Test
    fun `search is case-insensitive and matches expected tools`() {
        assertTrue(PdfToolRegistry.search("MERGE").any { it.id == PdfToolId.MERGE })
        val excel = PdfToolRegistry.search("excel").map { it.id }
        assertTrue(excel.contains(PdfToolId.PDF_TO_EXCEL))
        assertTrue(excel.contains(PdfToolId.EXCEL_TO_PDF))
        assertTrue(PdfToolRegistry.search("ocr").any { it.id == PdfToolId.OCR })
        assertTrue(PdfToolRegistry.search("signature").any { it.id == PdfToolId.SIGN })
    }

    @Test
    fun `search with no match returns empty`() {
        assertTrue(PdfToolRegistry.search("zzzznotatool").isEmpty())
    }

    @Test
    fun `byId resolves each enum value`() {
        PdfToolId.values().forEach { id ->
            assertEquals(id, PdfToolRegistry.byId(id).id)
        }
    }
}
