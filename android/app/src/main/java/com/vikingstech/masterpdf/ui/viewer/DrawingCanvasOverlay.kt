package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import com.vikingstech.masterpdf.domain.model.DrawingStroke
import com.vikingstech.masterpdf.domain.model.StrokePoint

/**
 * A freehand drawing surface scoped to a single page box. Stroke points are
 * reported as 0..1 fractions of this box so they survive layout/zoom changes and
 * map cleanly onto PDF user-space when committed. Both [strokes] and [currentPath]
 * belong to *this* page only — the parent passes per-page state, so a stroke never
 * bleeds onto other pages.
 */
@Composable
fun DrawingCanvasOverlay(
    strokes: List<DrawingStroke>,
    currentPath: List<StrokePoint>,
    strokeColor: Color,
    strokeWidth: Float,
    isDrawingEnabled: Boolean,
    onPointAdded: (StrokePoint) -> Unit,
    onStrokeFinished: () -> Unit,
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .fillMaxSize()
            .pointerInput(isDrawingEnabled) {
                if (!isDrawingEnabled) return@pointerInput
                val w = size.width.toFloat().coerceAtLeast(1f)
                val h = size.height.toFloat().coerceAtLeast(1f)

                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Main)
                        event.changes.forEach { change ->
                            val nx = (change.position.x / w).coerceIn(0f, 1f)
                            val ny = (change.position.y / h).coerceIn(0f, 1f)
                            when {
                                change.pressed -> onPointAdded(StrokePoint(nx, ny))
                                !change.pressed && change.previousPressed -> onStrokeFinished()
                            }
                            change.consume()
                        }
                    }
                }
            }
    ) {
        fun denorm(p: StrokePoint) = Offset(p.x * size.width, p.y * size.height)

        strokes.forEach { stroke ->
            for (i in 0 until stroke.points.size - 1) {
                drawLine(
                    color = stroke.color,
                    start = denorm(stroke.points[i]),
                    end = denorm(stroke.points[i + 1]),
                    strokeWidth = stroke.strokeWidth,
                    cap = StrokeCap.Round
                )
            }
        }

        for (i in 0 until currentPath.size - 1) {
            drawLine(
                color = strokeColor,
                start = denorm(currentPath[i]),
                end = denorm(currentPath[i + 1]),
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round
            )
        }
    }
}
