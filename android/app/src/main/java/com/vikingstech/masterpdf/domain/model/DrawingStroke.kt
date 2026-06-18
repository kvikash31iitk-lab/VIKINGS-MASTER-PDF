package com.vikingstech.masterpdf.domain.model

import androidx.compose.ui.graphics.Color

data class StrokePoint(
    val x: Float,
    val y: Float
)

data class DrawingStroke(
    val points: List<StrokePoint>,
    val color: Color = Color.Black,
    val strokeWidth: Float = 2f,
    val pageIndex: Int
)

data class InkAnnotation(
    val pageIndex: Int,
    val strokes: List<DrawingStroke>,
    val timestamp: Long = System.currentTimeMillis()
)
