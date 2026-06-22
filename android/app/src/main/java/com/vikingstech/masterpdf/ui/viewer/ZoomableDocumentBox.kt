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
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import kotlinx.coroutines.flow.SharedFlow

/**
 * One zoom/pan transform for the **whole** document. Wrap the viewer's
 * `LazyColumn` with this so every page shares a single scale/offset — pinch on
 * any page zooms the entire column, never just one page.
 *
 * The transform is applied via [Modifier.graphicsLayer] on the container, so the
 * lazy list keeps its normal layout (and only composes visible pages) while the
 * painted output is scaled and translated as a unit. [Modifier.clipToBounds]
 * keeps the magnified content from bleeding past the viewport.
 *
 * Gestures are handled on [PointerEventPass.Initial] so the container can claim a
 * pinch (two fingers) — or a drag while already zoomed — *before* the inner
 * `LazyColumn` would otherwise scroll. At rest (scale ≈ 1, one finger) nothing is
 * consumed, so normal vertical scrolling between pages is untouched. Pan offsets
 * are clamped to the viewport so the content can never be dragged fully away, and
 * returning to 1× snaps the pan back to zero.
 *
 * While [enabled] is false (e.g. drawing mode) all handling is suspended and the
 * view is forced back to its identity transform so overlays receive raw, 1:1
 * coordinates. Emitting on [zoomResetEvents] also snaps back to identity;
 * [onZoomChanged] reports the live shared scale for the toolbar/indicator.
 */
@Composable
fun ZoomableDocumentBox(
    zoomResetEvents: SharedFlow<Unit>,
    enabled: Boolean,
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

    // Entering a mode that needs raw gestures (drawing) must not strand a
    // half-zoomed / half-panned view.
    LaunchedEffect(enabled) {
        if (!enabled) {
            scale = 1f
            offset = Offset.Zero
            onZoomChanged(1f)
        }
    }

    Box(
        modifier = modifier
            .clipToBounds()
            .onSizeChanged { boxSize = it }
            .pointerInput(enabled) {
                if (!enabled) return@pointerInput
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                    do {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        val pressedCount = event.changes.count { it.pressed }
                        val isPinch = pressedCount >= 2

                        // Intercept only when zooming (two fingers) or panning an
                        // already-zoomed view; otherwise let the list scroll.
                        if (isPinch || scale > 1f) {
                            val zoomChange = event.calculateZoom()
                            val panChange = event.calculatePan()
                            val newScale = coerceZoomScale(scale * zoomChange)
                            offset = if (newScale > 1f) {
                                val raw = offset + panChange
                                Offset(
                                    x = clampPanOffset(raw.x, boxSize.width, newScale),
                                    y = clampPanOffset(raw.y, boxSize.height, newScale)
                                )
                            } else {
                                Offset.Zero
                            }
                            if (newScale != scale) {
                                scale = newScale
                                onZoomChanged(newScale)
                            }
                            // Claim moved pointers so the inner LazyColumn neither
                            // scrolls nor flings while we zoom/pan.
                            event.changes.forEach { if (it.positionChanged()) it.consume() }
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
