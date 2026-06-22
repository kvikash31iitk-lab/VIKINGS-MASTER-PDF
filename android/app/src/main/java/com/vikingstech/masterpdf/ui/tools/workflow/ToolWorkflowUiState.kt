package com.vikingstech.masterpdf.ui.tools.workflow

import com.vikingstech.masterpdf.domain.model.PageNumberPlacement
import com.vikingstech.masterpdf.ui.tools.PdfToolId

/**
 * State for one tool's workflow: the picked source URIs, all tool-specific
 * options (only the relevant subset is shown per tool), and the run/result
 * status. There is no premium/lock state here — every tool runs unconditionally.
 */
data class ToolWorkflowUiState(
    val toolId: PdfToolId,
    val sources: List<String> = emptyList(),
    val sourceNames: List<String> = emptyList(),
    val isProcessing: Boolean = false,
    val resultText: String? = null,
    val message: String? = null,
    val isError: Boolean = false,
    val finished: Boolean = false,

    // Options (defaults chosen to be sensible out of the box).
    val quality: Float = 0.7f,
    val password: String = "",
    val degrees: Int = 90,
    val pageRange: String = "",
    val watermarkText: String = "",
    val opacity: Float = 0.3f,
    val rotation: Float = 45f,
    val fontSize: Float = 24f,
    val startNumber: Int = 1,
    val placement: PageNumberPlacement = PageNumberPlacement.BOTTOM_CENTER,
    val createText: String = ""
)
