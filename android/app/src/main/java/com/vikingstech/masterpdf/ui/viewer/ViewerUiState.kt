package com.vikingstech.masterpdf.ui.viewer

import com.vikingstech.masterpdf.domain.model.PdfDocument
import com.vikingstech.masterpdf.domain.model.PdfPageInfo

data class ViewerUiState(
    val isLoading: Boolean = true,
    val document: PdfDocument? = null,
    val pages: List<PdfPageInfo> = emptyList(),
    val error: String? = null
)
