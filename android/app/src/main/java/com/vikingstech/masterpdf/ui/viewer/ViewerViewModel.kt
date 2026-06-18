package com.vikingstech.masterpdf.ui.viewer

import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vikingstech.masterpdf.di.IoDispatcher
import com.vikingstech.masterpdf.domain.model.Bookmark
import com.vikingstech.masterpdf.domain.model.ChatMessage
import com.vikingstech.masterpdf.domain.model.ChatRole
import com.vikingstech.masterpdf.domain.model.CustomStamp
import com.vikingstech.masterpdf.domain.model.DrawingStroke
import com.vikingstech.masterpdf.domain.model.InkAnnotation
import com.vikingstech.masterpdf.domain.model.Signature
import com.vikingstech.masterpdf.domain.model.StampPlacement
import com.vikingstech.masterpdf.domain.model.StrokePoint
import com.vikingstech.masterpdf.domain.usecase.AddBookmarkUseCase
import com.vikingstech.masterpdf.domain.usecase.AddSignatureUseCase
import com.vikingstech.masterpdf.domain.usecase.CloseDocumentUseCase
import com.vikingstech.masterpdf.domain.usecase.CommitInkAnnotationUseCase
import com.vikingstech.masterpdf.domain.usecase.CommitSignatureUseCase
import com.vikingstech.masterpdf.domain.usecase.DeleteBookmarkUseCase
import com.vikingstech.masterpdf.domain.usecase.ExtractAllTextUseCase
import com.vikingstech.masterpdf.domain.usecase.FillFormFieldUseCase
import com.vikingstech.masterpdf.domain.usecase.GetCustomStampsUseCase
import com.vikingstech.masterpdf.domain.usecase.GetFormFieldsUseCase
import com.vikingstech.masterpdf.domain.usecase.GetPageInfoUseCase
import com.vikingstech.masterpdf.domain.usecase.ObserveBookmarksUseCase
import com.vikingstech.masterpdf.domain.usecase.ObserveSignaturesUseCase
import com.vikingstech.masterpdf.domain.usecase.OpenDocumentUseCase
import com.vikingstech.masterpdf.domain.usecase.RenderPageUseCase
import com.vikingstech.masterpdf.domain.usecase.SaveCustomStampUseCase
import com.vikingstech.masterpdf.domain.usecase.StreamAiResponseUseCase
import com.vikingstech.masterpdf.domain.usecase.UpdateLastPageUseCase
import com.vikingstech.masterpdf.domain.util.Resource
import com.vikingstech.masterpdf.ui.navigation.Routes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import javax.inject.Inject

@HiltViewModel
class ViewerViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    @IoDispatcher private val io: CoroutineDispatcher,
    private val openDocument: OpenDocumentUseCase,
    private val getPageInfo: GetPageInfoUseCase,
    private val renderPageUseCase: RenderPageUseCase,
    private val closeDocument: CloseDocumentUseCase,
    private val commitInkAnnotation: CommitInkAnnotationUseCase,
    private val getFormFields: GetFormFieldsUseCase,
    private val fillFormField: FillFormFieldUseCase,
    private val getCustomStamps: GetCustomStampsUseCase,
    private val saveCustomStamp: SaveCustomStampUseCase,
    private val observeBookmarks: ObserveBookmarksUseCase,
    private val addBookmarkUseCase: AddBookmarkUseCase,
    private val deleteBookmarkUseCase: DeleteBookmarkUseCase,
    private val streamAiResponse: StreamAiResponseUseCase,
    private val extractAllText: ExtractAllTextUseCase,
    private val observeSignatures: ObserveSignaturesUseCase,
    private val addSignature: AddSignatureUseCase,
    private val commitSignatureUseCase: CommitSignatureUseCase,
    private val updateLastPage: UpdateLastPageUseCase
) : ViewModel() {

    private val sourceUri: String =
        Uri.decode(checkNotNull(savedStateHandle.get<String>(Routes.ARG_URI)))

    private val startPage: Int = savedStateHandle.get<Int>(Routes.ARG_START_PAGE) ?: 0

    private val _state = MutableStateFlow(ViewerUiState())
    val state: StateFlow<ViewerUiState> = _state.asStateFlow()

    /** Fires when [ZoomableBox] should snap back to its identity transform. */
    private val _zoomResetEvents = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val zoomResetEvents: SharedFlow<Unit> = _zoomResetEvents.asSharedFlow()

    /** Fires a target page index the viewer list should scroll to. */
    private val _jumpToPageEvent = MutableSharedFlow<Int>(extraBufferCapacity = 1)
    val jumpToPageEvent: SharedFlow<Int> = _jumpToPageEvent.asSharedFlow()

    private var documentId: String? = null
    private var currentPageIndex = 0

    /** Whole-document text, lazily extracted once for the AI assistant's context. */
    private var cachedDocText: String? = null
    private var docContextLoaded = false

    init {
        load()
        observeStamps()
        observeBookmarksFlow()
        observeSignaturesFlow()
    }

    private fun load() = viewModelScope.launch {
        _state.update { it.copy(isLoading = true, error = null) }
        when (val result = openDocument(sourceUri)) {
            is Resource.Success -> {
                documentId = result.data.id
                val pages = getPageInfo(result.data.id)
                val fields = (getFormFields(result.data.id) as? Resource.Success)?.data ?: emptyList()
                _state.update {
                    it.copy(isLoading = false, document = result.data, pages = pages, formFields = fields)
                }
                // Restore "Continue Reading" position, if any.
                if (startPage in 1 until pages.size) {
                    currentPageIndex = startPage
                    _jumpToPageEvent.tryEmit(startPage)
                }
            }
            is Resource.Error ->
                _state.update { it.copy(isLoading = false, error = result.message) }
            Resource.Loading -> Unit
        }
    }

    private fun observeStamps() = viewModelScope.launch {
        getCustomStamps().collect { stamps -> _state.update { it.copy(availableStamps = stamps) } }
    }

    private fun observeBookmarksFlow() = viewModelScope.launch {
        observeBookmarks(sourceUri).collect { marks -> _state.update { it.copy(bookmarks = marks) } }
    }

    private fun observeSignaturesFlow() = viewModelScope.launch {
        observeSignatures().collect { sigs -> _state.update { it.copy(signatures = sigs) } }
    }

    /** Render a single page; returns null if the doc isn't ready or render fails. */
    suspend fun renderPage(pageIndex: Int, targetWidthPx: Int): Bitmap? {
        val id = documentId ?: return null
        return (renderPageUseCase(id, pageIndex, targetWidthPx) as? Resource.Success)?.data
    }

    /** Record the first visible page; persists it for "Continue Reading". */
    fun onPageChanged(index: Int) {
        if (index == currentPageIndex) return
        currentPageIndex = index
        viewModelScope.launch { updateLastPage(sourceUri, index) }
    }

    // ── Zoom (Feature 1) ──────────────────────────────────────────────────

    fun resetZoom() {
        _zoomResetEvents.tryEmit(Unit)
        _state.update { it.copy(zoomLevel = 1f) }
    }

    fun onZoomChanged(level: Float) {
        _state.update { it.copy(zoomLevel = level) }
    }

    // ── Freehand drawing ──────────────────────────────────────────────────

    fun toggleDrawingMode() {
        _state.update { it.copy(isDrawingMode = !it.isDrawingMode, currentStrokePath = emptyList()) }
    }

    fun addPointToCurrentStroke(point: StrokePoint) {
        _state.update { it.copy(currentStrokePath = it.currentStrokePath + point) }
    }

    fun finishStroke() {
        _state.update { state ->
            if (state.currentStrokePath.isEmpty()) return@update state
            val stroke = DrawingStroke(
                points = state.currentStrokePath,
                color = state.strokeColor,
                strokeWidth = state.strokeWidth,
                pageIndex = 0
            )
            state.copy(
                currentPageStrokes = state.currentPageStrokes + stroke,
                currentStrokePath = emptyList()
            )
        }
    }

    fun clearStrokes() {
        _state.update { it.copy(currentPageStrokes = emptyList(), currentStrokePath = emptyList()) }
    }

    fun setStrokeColor(color: Color) = _state.update { it.copy(strokeColor = color) }

    fun setStrokeWidth(width: Float) = _state.update { it.copy(strokeWidth = width) }

    fun commitStrokes() = viewModelScope.launch {
        val s = _state.value
        if (s.currentPageStrokes.isEmpty() && s.currentStrokePath.isEmpty()) return@launch

        val allStrokes = if (s.currentStrokePath.isNotEmpty()) {
            s.currentPageStrokes + DrawingStroke(
                points = s.currentStrokePath,
                color = s.strokeColor,
                strokeWidth = s.strokeWidth,
                pageIndex = 0
            )
        } else {
            s.currentPageStrokes
        }

        documentId?.let { id ->
            commitInkAnnotation(id, InkAnnotation(pageIndex = 0, strokes = allStrokes))
            clearStrokes()
            _state.update { it.copy(isDrawingMode = false) }
        }
    }

    // ── Forms ─────────────────────────────────────────────────────────────

    fun toggleFormPanel() {
        _state.update { it.copy(showFormPanel = !it.showFormPanel, showAiPanel = false) }
    }

    fun updateFormFieldValue(fieldName: String, value: String) {
        _state.update { it.copy(formFieldValues = it.formFieldValues + (fieldName to value)) }
    }

    fun submitFormField(fieldName: String) = viewModelScope.launch {
        val value = _state.value.formFieldValues[fieldName] ?: ""
        documentId?.let { id -> fillFormField(id, fieldName, value) }
    }

    // ── Stamps ────────────────────────────────────────────────────────────

    fun toggleStampDesigner() {
        _state.update { it.copy(showStampDesigner = !it.showStampDesigner) }
    }

    fun saveNewStamp(stamp: CustomStamp) = viewModelScope.launch { saveCustomStamp(stamp) }

    fun selectStampForPlacement(stampId: String?) {
        _state.update { it.copy(selectedStampForPlacement = stampId) }
    }

    fun addStampPlacement(placement: StampPlacement) {
        _state.update { it.copy(stampPlacements = it.stampPlacements + placement) }
    }

    fun removeStampPlacement(index: Int) {
        _state.update { s -> s.copy(stampPlacements = s.stampPlacements.filterIndexed { i, _ -> i != index }) }
    }

    // ── Bookmarks (Feature 2) ─────────────────────────────────────────────

    fun toggleBookmarkPanel() {
        _state.update { it.copy(showBookmarkPanel = !it.showBookmarkPanel) }
    }

    fun addBookmark(pageIndex: Int, label: String) = viewModelScope.launch {
        val id = documentId ?: sourceUri
        val title = label.ifBlank { "Page ${pageIndex + 1}" }
        addBookmarkUseCase(Bookmark(documentId = id, pageIndex = pageIndex, label = title))
    }

    fun deleteBookmark(id: Long) = viewModelScope.launch { deleteBookmarkUseCase(id) }

    fun jumpToPage(pageIndex: Int) {
        _jumpToPageEvent.tryEmit(pageIndex)
        _state.update { it.copy(showBookmarkPanel = false) }
    }

    // ── AI chat (Feature 3) ───────────────────────────────────────────────

    fun toggleAiPanel() {
        _state.update { it.copy(showAiPanel = !it.showAiPanel, showFormPanel = false) }
    }

    fun setAiInput(text: String) {
        _state.update { it.copy(aiInputText = text) }
    }

    fun clearConversation() {
        _state.update { it.copy(chatMessages = emptyList()) }
    }

    fun sendAiMessage() = viewModelScope.launch {
        val userText = _state.value.aiInputText.trim()
        if (userText.isBlank() || _state.value.isAiStreaming) return@launch

        val userMsg = ChatMessage(role = ChatRole.USER, content = userText)
        _state.update {
            it.copy(aiInputText = "", chatMessages = it.chatMessages + userMsg, isAiStreaming = true)
        }

        ensureDocContext()

        val outgoing = buildList {
            cachedDocText?.takeIf { it.isNotBlank() }?.let { text ->
                add(ChatMessage(role = ChatRole.SYSTEM, content = SYSTEM_PROMPT_PREFIX + text.take(MAX_CONTEXT_CHARS)))
            }
            addAll(_state.value.chatMessages.filter { it.role != ChatRole.SYSTEM })
        }

        val assistant = ChatMessage(role = ChatRole.ASSISTANT, content = "", isStreaming = true)
        _state.update { it.copy(chatMessages = it.chatMessages + assistant) }

        try {
            streamAiResponse(outgoing).collect { token ->
                _state.update { s ->
                    s.copy(chatMessages = s.chatMessages.map { m ->
                        if (m.id == assistant.id) m.copy(content = m.content + token) else m
                    })
                }
            }
            _state.update { s ->
                s.copy(
                    isAiStreaming = false,
                    chatMessages = s.chatMessages.map { if (it.id == assistant.id) it.copy(isStreaming = false) else it }
                )
            }
        } catch (e: Exception) {
            _state.update { s ->
                s.copy(
                    isAiStreaming = false,
                    chatMessages = s.chatMessages.map {
                        if (it.id == assistant.id) {
                            it.copy(content = "Error: ${e.message ?: "request failed"}", isStreaming = false)
                        } else {
                            it
                        }
                    }
                )
            }
        }
    }

    private suspend fun ensureDocContext() {
        if (docContextLoaded) return
        docContextLoaded = true
        val id = documentId ?: return
        (extractAllText(id) as? Resource.Success)?.let { cachedDocText = it.data }
    }

    // ── Signatures (Feature 5) ────────────────────────────────────────────

    fun toggleSignatureCapture() {
        _state.update { it.copy(showSignatureCapture = !it.showSignatureCapture) }
    }

    fun saveSignature(bitmap: Bitmap) = viewModelScope.launch {
        val bytes = withContext(io) {
            ByteArrayOutputStream().use { out ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                out.toByteArray()
            }
        }
        addSignature("Signature ${System.currentTimeMillis()}", bytes)
    }

    fun selectSignatureForPlacement(sig: Signature) {
        _state.update { it.copy(signatureForPlacement = sig, showSignatureCapture = false) }
    }

    fun clearSignaturePlacement() {
        _state.update { it.copy(signatureForPlacement = null) }
    }

    /**
     * Commit the in-placement signature onto [pageIndex]. The position/size are
     * normalised fractions (0..1) of the page; they're converted here to PDF
     * user-space points (bottom-left origin) using the page geometry.
     */
    fun commitSignature(pageIndex: Int, normX: Float, normY: Float, normW: Float, normH: Float) =
        viewModelScope.launch {
            val id = documentId ?: return@launch
            val sig = _state.value.signatureForPlacement ?: return@launch
            val page = _state.value.pages.getOrNull(pageIndex) ?: return@launch

            val pageW = page.widthPx.toFloat()
            val pageH = page.heightPx.toFloat()
            val wPts = normW * pageW
            val hPts = normH * pageH
            val xPts = normX * pageW
            val yPts = pageH - (normY * pageH) - hPts // flip Y: screen top-left → PDF bottom-left

            val bytes = withContext(io) { runCatching { File(sig.pngPath).readBytes() }.getOrNull() }
            if (bytes != null) {
                commitSignatureUseCase(id, pageIndex, bytes, xPts, yPts, wPts, hPts)
            }
            clearSignaturePlacement()
        }

    override fun onCleared() {
        documentId?.let(closeDocument::invoke)
    }

    private companion object {
        const val SYSTEM_PROMPT_PREFIX =
            "You are an AI assistant. The user has opened a PDF. Here is its text content:\n\n"
        const val MAX_CONTEXT_CHARS = 24_000
    }
}
