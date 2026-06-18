package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.ui.graphics.Color
import com.vikingstech.masterpdf.domain.model.DrawingStroke
import com.vikingstech.masterpdf.domain.model.StrokePoint

data class DrawingOverlayState(
    val isDrawingEnabled: Boolean = false,
    val currentStrokes: List<DrawingStroke> = emptyList(),
    val currentPath: List<StrokePoint> = emptyList(),
    val strokeColor: Color = Color.Black,
    val strokeWidth: Float = 2f,
    val pageIndex: Int = 0
)
