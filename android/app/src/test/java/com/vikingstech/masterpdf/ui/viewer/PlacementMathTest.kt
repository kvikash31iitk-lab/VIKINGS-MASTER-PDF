package com.vikingstech.masterpdf.ui.viewer

import com.vikingstech.masterpdf.domain.model.DrawingStroke
import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import com.vikingstech.masterpdf.domain.model.StrokePoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlacementMathTest {

    private val tol = 0.001f

    @Test
    fun `normalizedRectToPdf flips Y and scales to points`() {
        // Top-left quarter of a 100x200 page.
        val rect = normalizedRectToPdf(0f, 0f, 0.5f, 0.5f, 100f, 200f)
        assertEquals(0f, rect.x, tol)
        assertEquals(50f, rect.width, tol)
        assertEquals(100f, rect.height, tol)
        // A box at the top (normY=0) sits at the upper half: lower edge at y=100.
        assertEquals(100f, rect.y, tol)
    }

    @Test
    fun `normalizedPointToPdf flips Y`() {
        val p = normalizedPointToPdf(0.5f, 0.25f, 100f, 200f)
        assertEquals(50f, p.x, tol)
        assertEquals(150f, p.y, tol) // 200 - 0.25*200
    }

    @Test
    fun `buildInkAnnotations routes strokes to the correct page index`() {
        val pages = listOf(
            PdfPageInfo(index = 0, widthPx = 100, heightPx = 200),
            PdfPageInfo(index = 1, widthPx = 100, heightPx = 200),
            PdfPageInfo(index = 2, widthPx = 100, heightPx = 200)
        )
        // Drawing on "page 3" (zero-based index 2).
        val pageStrokes = mapOf(
            2 to listOf(
                DrawingStroke(
                    points = listOf(StrokePoint(0f, 0f), StrokePoint(1f, 1f)),
                    pageIndex = 2
                )
            )
        )

        val annotations = buildInkAnnotations(pageStrokes, pages)

        assertEquals(1, annotations.size)
        val ink = annotations.single()
        assertEquals(2, ink.pageIndex)
        // (0,0) top-left → (0,200) bottom-left; (1,1) → (100,0).
        assertEquals(0f, ink.strokes[0].points[0].x, tol)
        assertEquals(200f, ink.strokes[0].points[0].y, tol)
        assertEquals(100f, ink.strokes[0].points[1].x, tol)
        assertEquals(0f, ink.strokes[0].points[1].y, tol)
    }

    @Test
    fun `buildInkAnnotations drops empty strokes and unknown pages`() {
        val pages = listOf(PdfPageInfo(index = 0, widthPx = 100, heightPx = 100))
        val pageStrokes = mapOf(
            0 to listOf(DrawingStroke(points = listOf(StrokePoint(0f, 0f)), pageIndex = 0)), // < 2 points
            5 to listOf( // page doesn't exist
                DrawingStroke(points = listOf(StrokePoint(0f, 0f), StrokePoint(1f, 1f)), pageIndex = 5)
            )
        )
        assertTrue(buildInkAnnotations(pageStrokes, pages).isEmpty())
    }

    @Test
    fun `shouldMaterializeSource only for transient content uris`() {
        assertTrue(shouldMaterializeSource("content", isPersisted = false))
        assertFalse(shouldMaterializeSource("content", isPersisted = true))
        assertFalse(shouldMaterializeSource("file", isPersisted = false))
        assertFalse(shouldMaterializeSource(null, isPersisted = false))
    }
}
