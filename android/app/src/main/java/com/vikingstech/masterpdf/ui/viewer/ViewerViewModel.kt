package com.vikingstech.masterpdf.ui.viewer

import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vikingstech.masterpdf.domain.model.DrawingStroke
import com.vikingstech.masterpdf.domain.model.InkAnnotation
import com.vikingstech.masterpdf.domain.model.StrokePoint
import com.vikingstech.masterpdf.domain.usecase.CloseDocumentUseCase
import com.vikingstech.masterpdf.domain.usecase.CommitInkAnnotationUseCase
import com.vikingstech.masterpdf.domain.usecase.GetPageInfoUseCase
import com.vikingstech.masterpdf.domain.usecase.OpenDocumentUseCase
import com.vikingstech.masterpdf.domain.usecase.RenderPageUseCase
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
class ViewerViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val openDocument: OpenDocumentUseCase,
    private val getPageInfo: GetPageInfoUseCase,
    private val renderPageUseCase: RenderPageUseCase,
    private val closeDocument: CloseDocumentUseCase,
    private val commitInkAnnotation: CommitInkAnnotationUseCase
) : ViewModel() {

    private val sourceUri: String =
        Uri.decode(checkNotNull(savedStateHandle.get<String>(Routes.ARG_URI)))

    private val _state = MutableStateFlow(ViewerUiState())
    val state: StateFlow<ViewerUiState> = _state.asStateFlow()

    private var documentId: String? = null

    init {
        load()
    }

    private fun load() = viewModelScope.launch {
        _state.update { it.copy(isLoading = true, error = null) }
        when (val result = openDocument(sourceUri)) {
            is Resource.Success -> {
                documentId = result.data.id
                val pages = getPageInfo(result.data.id)
                _state.update {
                    it.copy(isLoading = false, document = result.data, pages = pages)
                }
            }
            is Resource.Error ->
                _state.update { it.copy(isLoading = false, error = result.message) }
            Resource.Loading -> Unit
        }
    }

    /** Render a single page; returns null if the doc isn't ready or render fails. */
    suspend fun renderPage(pageIndex: Int, targetWidthPx: Int): Bitmap? {
        val id = documentId ?: return null
        return (renderPageUseCase(id, pageIndex, targetWidthPx) as? Resource.Success)?.data
    }

    fun toggleDrawingMode() {
        _state.update { it.copy(isDrawingMode = !it.isDrawingMode, currentStrokePath = emptyList()) }
    }

    fun addPointToCurrentStroke(point: StrokePoint) {
        _state.update { state ->
            state.copy(currentStrokePath = state.currentStrokePath + point)
        }
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

    fun setStrokeColor(color: Color) {
        _state.update { it.copy(strokeColor = color) }
    }

    fun setStrokeWidth(width: Float) {
        _state.update { it.copy(strokeWidth = width) }
    }

    fun commitStrokes() = viewModelScope.launch {
        val currentState = _state.value
        if (currentState.currentPageStrokes.isEmpty() && currentState.currentStrokePath.isEmpty()) {
            return@launch
        }

        val allStrokes = if (currentState.currentStrokePath.isNotEmpty()) {
            val lastStroke = DrawingStroke(
                points = currentState.currentStrokePath,
                color = currentState.strokeColor,
                strokeWidth = currentState.strokeWidth,
                pageIndex = 0
            )
            currentState.currentPageStrokes + lastStroke
        } else {
            currentState.currentPageStrokes
        }

        documentId?.let { id ->
            val annotation = InkAnnotation(
                pageIndex = 0,
                strokes = allStrokes
            )
            commitInkAnnotation(id, annotation)
            clearStrokes()
            _state.update { it.copy(isDrawingMode = false) }
        }
    }

    override fun onCleared() {
        documentId?.let(closeDocument::invoke)
    }
}
