package com.vikingstech.masterpdf.ui.viewer

import org.junit.Assert.assertEquals
import org.junit.Test

class ZoomMathTest {

    private val tol = 0.001f

    @Test
    fun `coerceZoomScale clamps into supported range`() {
        assertEquals(MIN_ZOOM_SCALE, coerceZoomScale(0.2f), tol) // below floor → 1x
        assertEquals(1f, coerceZoomScale(1f), tol)
        assertEquals(2.5f, coerceZoomScale(2.5f), tol)
        assertEquals(MAX_ZOOM_SCALE, coerceZoomScale(99f), tol) // above ceiling
    }

    @Test
    fun `maxPanOffset is zero at or below 1x`() {
        assertEquals(0f, maxPanOffset(1000, 1f), tol)
        assertEquals(0f, maxPanOffset(1000, 0.5f), tol)
    }

    @Test
    fun `maxPanOffset is half the overhang when zoomed`() {
        // 1000px wide at 2x overhangs by 1000px → 500px each side.
        assertEquals(500f, maxPanOffset(1000, 2f), tol)
        // 800px tall at 1.5x overhangs by 400px → 200px each side.
        assertEquals(200f, maxPanOffset(800, 1.5f), tol)
    }

    @Test
    fun `maxPanOffset guards an unmeasured viewport`() {
        assertEquals(0f, maxPanOffset(0, 3f), tol)
    }

    @Test
    fun `clampPanOffset keeps content from drifting off-viewport`() {
        // At 2x over 1000px the limit is ±500.
        assertEquals(500f, clampPanOffset(900f, 1000, 2f), tol)   // over → clamped
        assertEquals(-500f, clampPanOffset(-900f, 1000, 2f), tol) // under → clamped
        assertEquals(120f, clampPanOffset(120f, 1000, 2f), tol)   // within → unchanged
    }

    @Test
    fun `clampPanOffset forces zero when not zoomed`() {
        assertEquals(0f, clampPanOffset(250f, 1000, 1f), tol)
    }
}
