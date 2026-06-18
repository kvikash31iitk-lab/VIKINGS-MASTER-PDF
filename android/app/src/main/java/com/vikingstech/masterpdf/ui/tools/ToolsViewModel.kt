package com.vikingstech.masterpdf.ui.tools

import android.graphics.Bitmap
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vikingstech.masterpdf.domain.usecase.CloseDocumentUseCase
import com.vikingstech.masterpdf.domain.usecase.CompressPdfUseCase
import com.vikingstech.masterpdf.domain.usecase.DeletePagesUseCase
import com.vikingstech.masterpdf.domain.usecase.ExtractAllTextUseCase
import com.vikingstech.masterpdf.domain.usecase.GetPageInfoUseCase
import com.vikingstech.masterpdf.domain.usecase.MergePdfsUseCase
import com.vikingstech.masterpdf.domain.usecase.OpenDocumentUseCase
import com.vikingstech.masterpdf.domain.usecase.RenderPageUseCase
import com.vikingstech.masterpdf.domain.usecase.ReorderPagesUseCase
import com.vikingstech.masterpdf.domain.usecase.RotatePagesUseCase
import com.vikingstech.masterpdf.domain.usecase.SaveDocumentUseCase
import com.vikingstech.masterpdf.domain.util.Resource
import com.vikingstech.masterpdf.ui.navigation.Routes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ToolsViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val openDocument: OpenDocumentUseCase,
    private val getPageInfo: GetPageInfoUseCase,
    private val renderPageUseCase: RenderPageUseCase,
    private val reorderPages: ReorderPagesUseCase,
    private val deletePages: DeletePagesUseCase,
    private val rotatePages: RotatePagesUseCase,
    private val compressPdf: CompressPdfUseCase,
    private val extractAllText: ExtractAllTextUseCase,
    private val mergePdfs: MergePdfsUseCase,
    private val saveDocument: SaveDocumentUseCase,
    private val closeDocument: CloseDocumentUseCase
) : ViewModel() {

    private val sourceUri: String? =
        savedStateHandle.get<String>(Routes.ARG_URI)

    private val _state = MutableStateFlow(ToolsUiState())
    val state: StateFlow<ToolsUiState> = _state.asStateFlow()

    init {
        if (sourceUri != null) openSource(sourceUri)
    }

    private fun openSource(uri: String) = viewModelScope.launch {
        _state.update { it.copy(isProcessing = true, error = null) }
        when (val result = openDocument(uri)) {
            is Resource.Success -> {
                val pages = getPageInfo(result.data.id)
                _state.update {
                    it.copy(
                        isProcessing = false,
                        documentId = result.data.id,
                        documentName = result.data.name,
                        pageCount = pages.size
                    )
                }
            }
            is Resource.Error -> _state.update { it.copy(isProcessing = false, error = result.message) }
            Resource.Loading -> Unit
        }
    }

    suspend fun renderPage(pageIndex: Int, targetWidthPx: Int): Bitmap? {
        val id = _state.value.documentId ?: return null
        return (renderPageUseCase(id, pageIndex, targetWidthPx) as? Resource.Success)?.data
    }

    fun setExpanded(section: ToolSection?) {
        _state.update { it.copy(expandedSection = if (it.expandedSection == section) null else section) }
    }

    fun clearMessages() = _state.update { it.copy(result = null, error = null) }

    // ── Page Manager ───────────────────────────────────────────────────────

    /**
     * Reorders kept pages into [keepOrder] (original indices) and removes
     * [deleted]. Achieved by permuting so kept pages lead, then trimming the tail.
     */
    fun applyPageEdits(keepOrder: List<Int>, deleted: List<Int>) = viewModelScope.launch {
        val id = _state.value.documentId ?: return@launch
        runProcessing {
            if (deleted.isEmpty() && keepOrder == keepOrder.sorted()) {
                // Pure reorder (or no-op).
                if (keepOrder != (0 until _state.value.pageCount).toList()) {
                    reorderPages(id, keepOrder).orThrow()
                }
            } else {
                val fullPermutation = keepOrder + deleted.sorted()
                reorderPages(id, fullPermutation).orThrow()
                if (deleted.isNotEmpty()) {
                    val tail = (keepOrder.size until fullPermutation.size).toList()
                    deletePages(id, tail).orThrow()
                }
            }
            refreshPageCount(id)
            "Pages updated"
        }
    }

    // ── Rotate ───────────────────────────────────────────────────────────────

    fun rotate(pageIndices: List<Int>, degrees: Int) = viewModelScope.launch {
        val id = _state.value.documentId ?: return@launch
        if (pageIndices.isEmpty()) return@launch
        runProcessing {
            rotatePages(id, pageIndices, degrees).orThrow()
            "Rotated ${pageIndices.size} page(s)"
        }
    }

    // ── Compress ─────────────────────────────────────────────────────────────

    fun compress(quality: Float, destinationUri: String) = viewModelScope.launch {
        val id = _state.value.documentId ?: return@launch
        runProcessing {
            compressPdf(id, quality, destinationUri).orThrow()
            "Compressed copy saved"
        }
    }

    // ── Extract text ─────────────────────────────────────────────────────────

    fun extractText() = viewModelScope.launch {
        val id = _state.value.documentId ?: return@launch
        _state.update { it.copy(isProcessing = true, error = null) }
        when (val res = extractAllText(id)) {
            is Resource.Success ->
                _state.update { it.copy(isProcessing = false, extractedText = res.data) }
            is Resource.Error ->
                _state.update { it.copy(isProcessing = false, error = res.message) }
            Resource.Loading -> Unit
        }
    }

    // ── Save as ──────────────────────────────────────────────────────────────

    fun saveAs(destinationUri: String) = viewModelScope.launch {
        val id = _state.value.documentId ?: return@launch
        runProcessing {
            saveDocument(id, destinationUri).orThrow()
            "Saved"
        }
    }

    // ── Merge ────────────────────────────────────────────────────────────────

    fun addMergeFiles(files: List<MergeFile>) {
        _state.update { it.copy(mergeFiles = it.mergeFiles + files) }
    }

    fun removeMergeFile(index: Int) {
        _state.update { s -> s.copy(mergeFiles = s.mergeFiles.filterIndexed { i, _ -> i != index }) }
    }

    fun moveMergeFile(from: Int, to: Int) {
        _state.update { s ->
            val list = s.mergeFiles.toMutableList()
            if (from in list.indices && to in list.indices) {
                val item = list.removeAt(from)
                list.add(to, item)
            }
            s.copy(mergeFiles = list)
        }
    }

    fun merge(destinationUri: String) = viewModelScope.launch {
        val uris = _state.value.mergeFiles.map { it.uri }
        if (uris.isEmpty()) return@launch
        runProcessing {
            mergePdfs(uris, destinationUri).orThrow()
            "Merged ${uris.size} file(s)"
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private suspend fun refreshPageCount(id: String) {
        val pages = getPageInfo(id)
        _state.update { it.copy(pageCount = pages.size) }
    }

    private suspend fun runProcessing(block: suspend () -> String) {
        _state.update { it.copy(isProcessing = true, error = null, result = null) }
        try {
            val message = block()
            _state.update { it.copy(isProcessing = false, result = message) }
        } catch (e: Exception) {
            _state.update { it.copy(isProcessing = false, error = e.message ?: "Operation failed") }
        }
    }

    private fun <T> Resource<T>.orThrow(): T = when (this) {
        is Resource.Success -> data
        is Resource.Error -> throw IllegalStateException(message)
        Resource.Loading -> throw IllegalStateException("Unexpected loading state")
    }

    override fun onCleared() {
        _state.value.documentId?.let(closeDocument::invoke)
    }
}
