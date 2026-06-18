package com.vikingstech.masterpdf.domain.model

/**
 * Geometry for a single page, used by the viewer to lay out placeholders and
 * size render requests before the bitmap exists (avoids layout shifts).
 */
data class PdfPageInfo(
    val index: Int,
    val widthPx: Int,
    val heightPx: Int,
    val rotationDegrees: Int = 0
) {
    val aspectRatio: Float
        get() = if (heightPx == 0) 1f else widthPx.toFloat() / heightPx.toFloat()
}
