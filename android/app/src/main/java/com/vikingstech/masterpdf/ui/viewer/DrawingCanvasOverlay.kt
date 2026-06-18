package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import com.vikingstech.masterpdf.domain.model.DrawingStroke
import com.vikingstech.masterpdf.domain.model.StrokePoint

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
            .fillMaxWidth()
            .pointerInput(isDrawingEnabled) {
                if (!isDrawingEnabled) return@pointerInput

                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Main)
                        event.changes.forEach { change ->
                            val position = change.position
                            val point = StrokePoint(position.x, position.y)

                            when {
                                change.pressed && !change.previousPressed -> {
                                    onPointAdded(point)
                                }
                                change.pressed -> {
                                    onPointAdded(point)
                                }
                                !change.pressed && change.previousPressed -> {
                                    onStrokeFinished()
                                }
                            }
                            change.consume()
                        }
                    }
                }
            }
    ) {
        strokes.forEach { stroke ->
            if (stroke.points.size > 1) {
                for (i in 0 until stroke.points.size - 1) {
                    val start = Offset(stroke.points[i].x, stroke.points[i].y)
                    val end = Offset(stroke.points[i + 1].x, stroke.points[i + 1].y)
                    drawLine(
                        color = stroke.color,
                        start = start,
                        end = end,
                        strokeWidth = stroke.strokeWidth,
                        cap = StrokeCap.Round
                    )
                }
            }
        }

        if (currentPath.size > 1) {
            for (i in 0 until currentPath.size - 1) {
                val start = Offset(currentPath[i].x, currentPath[i].y)
                val end = Offset(currentPath[i + 1].x, currentPath[i + 1].y)
                drawLine(
                    color = strokeColor,
                    start = start,
                    end = end,
                    strokeWidth = strokeWidth,
                    cap = StrokeCap.Round
                )
            }
        }
    }
}
