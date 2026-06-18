package com.vikingstech.masterpdf.ui.tools

/** Which accordion section is currently expanded (only one at a time). */
enum class ToolSection { PAGE_MANAGER, ROTATE, COMPRESS, EXTRACT, MERGE }

/** A picked file awaiting merge. */
data class MergeFile(val uri: String, val name: String)

data class ToolsUiState(
    val documentId: String? = null,
    val documentName: String = "",
    val pageCount: Int = 0,
    val isProcessing: Boolean = false,
    val result: String? = null,
    val error: String? = null,
    val extractedText: String? = null,
    val mergeFiles: List<MergeFile> = emptyList(),
    val expandedSection: ToolSection? = null
) {
    val hasDocument: Boolean get() = documentId != null
}
