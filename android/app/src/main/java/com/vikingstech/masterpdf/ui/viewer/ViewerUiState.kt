package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.ui.graphics.Color
import com.vikingstech.masterpdf.domain.model.DrawingStroke
import com.vikingstech.masterpdf.domain.model.PdfDocument
import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import com.vikingstech.masterpdf.domain.model.StrokePoint

data class ViewerUiState(
    val isLoading: Boolean = true,
    val document: PdfDocument? = null,
    val pages: List<PdfPageInfo> = emptyList(),
    val error: String? = null,
    val isDrawingMode: Boolean = false,
    val currentPageStrokes: List<DrawingStroke> = emptyList(),
    val currentStrokePath: List<StrokePoint> = emptyList(),
    val strokeColor: Color = Color.Black,
    val strokeWidth: Float = 2f
)
