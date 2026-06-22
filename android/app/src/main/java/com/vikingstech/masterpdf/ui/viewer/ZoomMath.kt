package com.vikingstech.masterpdf.ui.viewer

/**
 * Pure, Android-free math for the shared document zoom/pan. Keeping it here (not
 * buried in the composable) makes the clamp/scale rules unit-testable and keeps a
 * single source of truth for the limits.
 */

/** Lower zoom bound — fit-to-width is the baseline; we never shrink below it. */
const val MIN_ZOOM_SCALE = 1.0f

/** Upper zoom bound. */
const val MAX_ZOOM_SCALE = 5.0f

/** Clamp a raw scale into the supported range. */
fun coerceZoomScale(scale: Float): Float = scale.coerceIn(MIN_ZOOM_SCALE, MAX_ZOOM_SCALE)

/**
 * Maximum absolute pan, in pixels, for a centre-origin transform: at [scale] the
 * content overhangs the [extent]-px viewport by `extent*(scale-1)`, half on each
 * side. At/below 1× (or with an unmeasured viewport) there is nothing to pan.
 */
fun maxPanOffset(extent: Int, scale: Float): Float =
    if (scale <= 1f || extent <= 0) 0f else (extent * (scale - 1f)) / 2f

/** Clamp one pan axis so the magnified content can never be dragged off-viewport. */
fun clampPanOffset(raw: Float, extent: Int, scale: Float): Float {
    val max = maxPanOffset(extent, scale)
    return raw.coerceIn(-max, max)
}
