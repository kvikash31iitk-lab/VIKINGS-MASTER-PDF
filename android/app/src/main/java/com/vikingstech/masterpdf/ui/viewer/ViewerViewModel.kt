package com.vikingstech.masterpdf.ui.viewer

import android.graphics.Bitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vikingstech.masterpdf.di.IoDispatcher
import com.vikingstech.masterpdf.domain.model.Bookmark
import com.vikingstech.masterpdf.domain.model.ChatMessage
import com.vikingstech.masterpdf.domain.model.ChatRole
import com.vikingstech.masterpdf.domain.model.CustomStamp
import com.vikingstech.masterpdf.domain.model.DrawingStroke
import com.vikingstech.masterpdf.domain.model.PdfFormField
import com.vikingstech.masterpdf.domain.model.Signature
import com.vikingstech.masterpdf.domain.model.StrokePoint
import com.vikingstech.masterpdf.domain.usecase.AddBookmarkUseCase
import com.vikingstech.masterpdf.domain.usecase.AddSignatureUseCase
import com.vikingstech.masterpdf.domain.usecase.CloseDocumentUseCase
import com.vikingstech.masterpdf.domain.usecase.CommitInkAnnotationUseCase
import com.vikingstech.masterpdf.domain.usecase.CommitSignatureUseCase
import com.vikingstech.masterpdf.domain.usecase.CommitStampUseCase
import com.vikingstech.masterpdf.domain.usecase.DeleteBookmarkUseCase
import com.vikingstech.masterpdf.domain.usecase.ExtractAllTextUseCase
import com.vikingstech.masterpdf.domain.usecase.ExtractTextUseCase
import com.vikingstech.masterpdf.domain.usecase.FillFormFieldsUseCase
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
    private val fillFormFields: FillFormFieldsUseCase,
    private val getCustomStamps: GetCustomStampsUseCase,
    private val saveCustomStamp: SaveCustomStampUseCase,
    private val commitStamp: CommitStampUseCase,
    private val observeBookmarks: ObserveBookmarksUseCase,
    private val addBookmarkUseCase: AddBookmarkUseCase,
    private val deleteBookmarkUseCase: DeleteBookmarkUseCase,
    private val streamAiResponse: StreamAiResponseUseCase,
    private val extractAllText: ExtractAllTextUseCase,
    private val extractText: ExtractTextUseCase,
    private val observeSignatures: ObserveSignaturesUseCase,
    private val addSignature: AddSignatureUseCase,
    private val commitSignatureUseCase: CommitSignatureUseCase,
    private val updateLastPage: UpdateLastPageUseCase
) : ViewModel() {

    private val sourceUri: String =
        checkNotNull(savedStateHandle.get<String>(Routes.ARG_URI))

    private val startPage: Int = savedStateHandle.get<Int>(Routes.ARG_START_PAGE) ?: 0

    private val _state = MutableStateFlow(ViewerUiState())
    val state: StateFlow<ViewerUiState> = _state.asStateFlow()

    /** Fires when [ZoomableDocumentBox] should snap back to its identity transform. */
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
                    it.copy(
                        isLoading = false,
                        document = result.data,
                        pages = pages,
                        formFields = fields,
                        formFieldValues = initialFormValues(fields)
                    )
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
        _state.update { if (it.currentPage == index) it else it.copy(currentPage = index) }
        if (index == currentPageIndex) return
        currentPageIndex = index
        viewModelScope.launch { updateLastPage(sourceUri, index) }
    }

    fun consumeUserMessage() = _state.update { it.copy(userMessage = null) }

    // ── Zoom (Feature 1) ──────────────────────────────────────────────────

    fun resetZoom() {
        _zoomResetEvents.tryEmit(Unit)
        _state.update { it.copy(zoomLevel = 1f) }
    }

    fun onZoomChanged(level: Float) {
        _state.update { it.copy(zoomLevel = level) }
    }

    // ── Freehand drawing (page-aware) ──────────────────────────────────────

    fun toggleDrawingMode() {
        _state.update {
            it.copy(
                isDrawingMode = !it.isDrawingMode,
                pageStrokes = emptyMap(),
                currentStrokePath = emptyList(),
                activeDrawPage = null
            )
        }
    }

    /** A stroke point as a 0..1 fraction of [pageIndex]'s on-screen box. */
    fun addPointToCurrentStroke(pageIndex: Int, point: StrokePoint) {
        _state.update { s ->
            val page = if (s.currentStrokePath.isEmpty()) pageIndex else s.activeDrawPage ?: pageIndex
            s.copy(activeDrawPage = page, currentStrokePath = s.currentStrokePath + point)
        }
    }

    fun finishStroke(pageIndex: Int) {
        _state.update { s ->
            val path = s.currentStrokePath
            if (path.size < 2) {
                return@update s.copy(currentStrokePath = emptyList(), activeDrawPage = null)
            }
            val target = s.activeDrawPage ?: pageIndex
            val stroke = DrawingStroke(
                points = path,
                color = s.strokeColor,
                strokeWidth = s.strokeWidth,
                pageIndex = target
            )
            val updated = s.pageStrokes.toMutableMap().apply {
                put(target, (this[target] ?: emptyList()) + stroke)
            }
            s.copy(pageStrokes = updated, currentStrokePath = emptyList(), activeDrawPage = null)
        }
    }

    fun clearStrokes() {
        _state.update {
            it.copy(pageStrokes = emptyMap(), currentStrokePath = emptyList(), activeDrawPage = null)
        }
    }

    fun setStrokeColor(color: Color) = _state.update { it.copy(strokeColor = color) }

    fun setStrokeWidth(width: Float) = _state.update { it.copy(strokeWidth = width) }

    fun commitStrokes() = viewModelScope.launch {
        val id = documentId ?: return@launch
        // Finalise any in-progress stroke first.
        finishStroke(_state.value.activeDrawPage ?: _state.value.currentPage)

        val s = _state.value
        val annotations = buildInkAnnotations(s.pageStrokes, s.pages)
        if (annotations.isEmpty()) {
            _state.update {
                it.copy(isDrawingMode = false, pageStrokes = emptyMap(), currentStrokePath = emptyList())
            }
            return@launch
        }
        annotations.forEach { annotation -> commitInkAnnotation(id, annotation) }
        _state.update {
            it.copy(
                isDrawingMode = false,
                pageStrokes = emptyMap(),
                currentStrokePath = emptyList(),
                activeDrawPage = null
            )
        }
        refreshAfterMutation(message = "Drawing applied")
    }

    // ── Forms ─────────────────────────────────────────────────────────────

    fun toggleFormPanel() {
        _state.update { it.copy(showFormPanel = !it.showFormPanel, showAiPanel = false) }
    }

    fun updateFormFieldValue(fieldName: String, value: String) {
        _state.update { it.copy(formFieldValues = it.formFieldValues + (fieldName to value)) }
    }

    fun submitFormField(fieldName: String) = viewModelScope.launch {
        val id = documentId ?: return@launch
        val value = _state.value.formFieldValues[fieldName] ?: ""
        _state.update { it.copy(isSavingForm = true) }
        val result = fillFormField(id, fieldName, value)
        if (result is Resource.Error) {
            _state.update { it.copy(isSavingForm = false, userMessage = result.message ?: "Could not save field") }
        } else {
            refreshAfterMutation(message = "Field saved", reinitFormValues = true)
            _state.update { it.copy(isSavingForm = false) }
        }
    }

    /** Apply every editable field's current value in one pass. */
    fun applyAllFormFields() = viewModelScope.launch {
        val id = documentId ?: return@launch
        val s = _state.value
        val editable = s.formFields.filterNot { it.isReadOnly }.map { it.name }.toSet()
        val values = s.formFieldValues.filterKeys { it in editable }
        if (values.isEmpty()) {
            _state.update { it.copy(userMessage = "No form changes to apply") }
            return@launch
        }
        _state.update { it.copy(isSavingForm = true) }
        val result = fillFormFields(id, values)
        if (result is Resource.Error) {
            _state.update { it.copy(isSavingForm = false, userMessage = result.message ?: "Could not save form") }
        } else {
            refreshAfterMutation(message = "Form saved", reinitFormValues = true)
            _state.update { it.copy(isSavingForm = false) }
        }
    }

    // ── Stamps ────────────────────────────────────────────────────────────

    fun toggleStampPicker() {
        _state.update { it.copy(showStampPicker = !it.showStampPicker) }
    }

    fun openStampDesigner() {
        _state.update { it.copy(showStampDesigner = true, showStampPicker = false) }
    }

    fun closeStampDesigner() {
        _state.update { it.copy(showStampDesigner = false) }
    }

    fun saveNewStamp(stamp: CustomStamp) = viewModelScope.launch {
        saveCustomStamp(stamp)
        // Return to the picker so the freshly-saved stamp can be placed.
        _state.update { it.copy(showStampDesigner = false, showStampPicker = true) }
    }

    /** Begin positioning [stamp] on the current page. */
    fun beginStampPlacement(stamp: CustomStamp) {
        _state.update {
            it.copy(placementStamp = stamp, placementPage = it.currentPage, showStampPicker = false)
        }
    }

    fun cancelStampPlacement() {
        _state.update { it.copy(placementStamp = null) }
    }

    fun commitStampPlacement(normX: Float, normY: Float, normW: Float, normH: Float) =
        viewModelScope.launch {
            val id = documentId ?: return@launch
            val s = _state.value
            val stamp = s.placementStamp ?: return@launch
            val page = s.pages.getOrNull(s.placementPage) ?: return@launch
            val rect = normalizedRectToPdf(
                normX, normY, normW, normH,
                page.widthPx.toFloat(), page.heightPx.toFloat()
            )
            val result = commitStamp(
                documentId = id,
                pageIndex = s.placementPage,
                text = stamp.text,
                textArgb = stamp.textColor.toArgb(),
                backgroundArgb = stamp.backgroundColor.toArgb(),
                borderArgb = stamp.borderColor.toArgb(),
                borderWidthPts = stamp.borderWidth,
                fontSizePts = stamp.fontSize,
                xPts = rect.x,
                yPts = rect.y,
                widthPts = rect.width,
                heightPts = rect.height
            )
            _state.update { it.copy(placementStamp = null) }
            if (result is Resource.Error) {
                _state.update { it.copy(userMessage = result.message ?: "Could not place stamp") }
            } else {
                refreshAfterMutation(message = "Stamp applied")
            }
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

        val docText = cachedDocText
        if (docText.isNullOrBlank()) {
            // No embedded text layer — almost certainly a scanned PDF.
            val note = ChatMessage(
                role = ChatRole.ASSISTANT,
                content = "This document doesn't contain any selectable text — it looks like a " +
                    "scanned PDF. I can't read its contents without OCR, so I can't answer " +
                    "questions about it yet."
            )
            _state.update { it.copy(isAiStreaming = false, chatMessages = it.chatMessages + note) }
            return@launch
        }

        val outgoing = buildList {
            add(ChatMessage(role = ChatRole.SYSTEM, content = SYSTEM_PROMPT_PREFIX + docText.take(MAX_CONTEXT_CHARS)))
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

    /**
     * Lazily builds the AI context. Extracts page-by-page up to a page/char
     * budget so very large or scanned documents never block indefinitely.
     */
    private suspend fun ensureDocContext() {
        if (docContextLoaded) return
        docContextLoaded = true
        val id = documentId ?: return
        _state.update { it.copy(isExtractingContext = true) }
        val pageCount = _state.value.pages.size
        val text = if (pageCount > 0) {
            val sb = StringBuilder()
            var page = 0
            while (page < pageCount && page < MAX_CONTEXT_PAGES && sb.length < MAX_CONTEXT_CHARS) {
                (extractText(id, page) as? Resource.Success)?.data
                    ?.takeIf { it.isNotBlank() }
                    ?.let { sb.append(it).append('\n') }
                page++
            }
            sb.toString()
        } else {
            (extractAllText(id) as? Resource.Success)?.data.orEmpty()
        }
        cachedDocText = text.take(MAX_CONTEXT_CHARS)
        _state.update { it.copy(isExtractingContext = false) }
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
        _state.update {
            it.copy(
                signatureForPlacement = sig,
                placementPage = it.currentPage,
                showSignatureCapture = false
            )
        }
    }

    fun clearSignaturePlacement() {
        _state.update { it.copy(signatureForPlacement = null) }
    }

    /**
     * Commit the in-placement signature onto [ViewerUiState.placementPage]. The
     * box is given as normalised fractions (0..1) of that page; they're converted
     * here to PDF user-space points (bottom-left origin) using the page geometry.
     */
    fun commitSignature(normX: Float, normY: Float, normW: Float, normH: Float) =
        viewModelScope.launch {
            val id = documentId ?: return@launch
            val s = _state.value
            val sig = s.signatureForPlacement ?: return@launch
            val page = s.pages.getOrNull(s.placementPage) ?: return@launch
            val rect = normalizedRectToPdf(
                normX, normY, normW, normH,
                page.widthPx.toFloat(), page.heightPx.toFloat()
            )

            val bytes = withContext(io) { runCatching { File(sig.pngPath).readBytes() }.getOrNull() }
            _state.update { it.copy(signatureForPlacement = null) }
            if (bytes != null) {
                val result = commitSignatureUseCase(
                    id, s.placementPage, bytes, rect.x, rect.y, rect.width, rect.height
                )
                if (result is Resource.Error) {
                    _state.update { it.copy(userMessage = result.message ?: "Could not place signature") }
                } else {
                    refreshAfterMutation(message = "Signature applied")
                }
            }
        }

    // ── mutation refresh ──────────────────────────────────────────────────

    /**
     * After a successful edit: bump the render revision (so cached page bitmaps
     * are dropped), refresh page geometry and form fields, and invalidate the AI
     * text cache since the document content changed.
     */
    private suspend fun refreshAfterMutation(message: String? = null, reinitFormValues: Boolean = false) {
        val id = documentId ?: return
        val pages = getPageInfo(id)
        val fields = (getFormFields(id) as? Resource.Success)?.data ?: _state.value.formFields
        cachedDocText = null
        docContextLoaded = false
        _state.update {
            it.copy(
                renderRevision = it.renderRevision + 1,
                pages = pages,
                formFields = fields,
                formFieldValues = if (reinitFormValues) initialFormValues(fields) else it.formFieldValues,
                userMessage = message ?: it.userMessage
            )
        }
    }

    override fun onCleared() {
        documentId?.let(closeDocument::invoke)
    }

    private companion object {
        const val SYSTEM_PROMPT_PREFIX =
            "You are an AI assistant. The user has opened a PDF. Here is its text content:\n\n"
        const val MAX_CONTEXT_CHARS = 24_000
        const val MAX_CONTEXT_PAGES = 80
    }
}

/** Seed editable form values from the document's extracted field values. */
fun initialFormValues(fields: List<PdfFormField>): Map<String, String> =
    fields.associate { it.name to it.value }
