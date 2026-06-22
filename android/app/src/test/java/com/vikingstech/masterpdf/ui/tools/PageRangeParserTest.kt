package com.vikingstech.masterpdf.ui.tools

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PageRangeParserTest {

    @Test
    fun `blank spec means all pages`() {
        assertEquals(listOf(0, 1, 2, 3, 4), PageRangeParser.parse("", 5))
        assertEquals(listOf(0, 1, 2), PageRangeParser.parse("   ", 3))
    }

    @Test
    fun `range converts one-based to zero-based`() {
        assertEquals(listOf(0, 1, 2), PageRangeParser.parse("1-3", 5))
    }

    @Test
    fun `individual pages and ranges combine, sorted and de-duplicated`() {
        assertEquals(listOf(0, 2, 4), PageRangeParser.parse("1,3,5", 5))
        assertEquals(listOf(0, 1, 2, 4), PageRangeParser.parse("1-3,3,5", 5))
    }

    @Test
    fun `reversed range is tolerated`() {
        assertEquals(listOf(2, 3, 4), PageRangeParser.parse("5-3", 5))
    }

    @Test
    fun `out-of-range numbers are clamped away`() {
        assertEquals(listOf(1, 2), PageRangeParser.parse("2-99", 3))
        assertTrue(PageRangeParser.parse("0", 3).isEmpty())
        assertTrue(PageRangeParser.parse("9", 3).isEmpty())
    }

    @Test
    fun `garbage tokens are ignored`() {
        assertTrue(PageRangeParser.parse("abc", 3).isEmpty())
        assertEquals(listOf(0), PageRangeParser.parse("1,abc", 3))
    }

    @Test
    fun `zero page count yields empty`() {
        assertTrue(PageRangeParser.parse("1-3", 0).isEmpty())
    }
}
