package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import kotlinx.coroutines.flow.SharedFlow
import kotlin.math.abs

private const val MIN_SCALE = 0.5f
private const val MAX_SCALE = 5.0f

/**
 * Wraps [content] with pinch-to-zoom and (when zoomed in) two-finger / drag pan,
 * applied through [Modifier.graphicsLayer] so it never triggers relayout.
 *
 * Crucially, single-finger drags are only consumed once the page is actually
 * zoomed in — at rest (scale ≈ 1) drags pass through so the enclosing
 * `LazyColumn` keeps scrolling between pages. A pinch is always honoured so the
 * user can start zooming from rest.
 *
 * When [isDrawingEnabled] is true all zoom/pan handling is suspended so the
 * drawing overlay receives the raw, untransformed gesture stream.
 *
 * Emitting on [zoomResetEvents] snaps the view back to its identity transform;
 * [onZoomChanged] reports the live scale so the toolbar can show a reset button.
 */
@Composable
fun ZoomableBox(
    zoomResetEvents: SharedFlow<Unit>,
    isDrawingEnabled: Boolean,
    onZoomChanged: (Float) -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    var boxSize by remember { mutableStateOf(IntSize.Zero) }

    // Snap back to identity whenever the host requests a reset.
    LaunchedEffect(zoomResetEvents) {
        zoomResetEvents.collect {
            scale = 1f
            offset = Offset.Zero
            onZoomChanged(1f)
        }
    }

    // Leaving draw mode should not strand a half-panned view.
    LaunchedEffect(isDrawingEnabled) {
        if (isDrawingEnabled) {
            scale = 1f
            offset = Offset.Zero
            onZoomChanged(1f)
        }
    }

    Box(
        modifier = modifier
            .onSizeChanged { boxSize = it }
            .pointerInput(isDrawingEnabled) {
                if (isDrawingEnabled) return@pointerInput
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    do {
                        val event = awaitPointerEvent()
                        val canceled = event.changes.any { it.isConsumed }
                        if (canceled) break

                        val zoomChange = event.calculateZoom()
                        val panChange = event.calculatePan()
                        val isPinch = abs(zoomChange - 1f) > 0.001f

                        // Only intercept once a pinch begins or we're already
                        // zoomed; otherwise let the list scroll.
                        if (isPinch || scale > 1f) {
                            val newScale = (scale * zoomChange).coerceIn(MIN_SCALE, MAX_SCALE)
                            scale = newScale
                            offset = if (newScale > 1f) {
                                clampOffset(offset + panChange, newScale, boxSize)
                            } else {
                                Offset.Zero
                            }
                            onZoomChanged(newScale)
                            event.changes.forEach(PointerInputChange::consumeIfMoved)
                        }
                    } while (event.changes.any { it.pressed })
                }
            }
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                translationX = offset.x
                translationY = offset.y
            },
        content = content
    )
}

/** Keep the panned content from drifting entirely off its own bounds. */
private fun clampOffset(raw: Offset, scale: Float, size: IntSize): Offset {
    if (size == IntSize.Zero) return raw
    val maxX = (size.width * (scale - 1f)) / 2f
    val maxY = (size.height * (scale - 1f)) / 2f
    return Offset(
        x = raw.x.coerceIn(-maxX, maxX),
        y = raw.y.coerceIn(-maxY, maxY)
    )
}

private fun PointerInputChange.consumeIfMoved() {
    if (positionChanged()) consume()
}
