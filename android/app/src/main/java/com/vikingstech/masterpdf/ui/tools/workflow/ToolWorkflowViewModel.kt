package com.vikingstech.masterpdf.ui.tools.workflow

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vikingstech.masterpdf.domain.model.ImageOutputFormat
import com.vikingstech.masterpdf.domain.model.OfficeFormat
import com.vikingstech.masterpdf.domain.model.PageNumberPlacement
import com.vikingstech.masterpdf.domain.repository.PdfToolsRepository
import com.vikingstech.masterpdf.domain.util.Resource
import com.vikingstech.masterpdf.ui.navigation.Routes
import com.vikingstech.masterpdf.ui.tools.PdfToolId
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ToolWorkflowViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val repo: PdfToolsRepository
) : ViewModel() {

    private val toolId: PdfToolId =
        runCatching { PdfToolId.valueOf(savedStateHandle.get<String>(Routes.ARG_TOOL_ID) ?: "") }
            .getOrDefault(PdfToolId.MERGE)

    private val _state = MutableStateFlow(ToolWorkflowUiState(toolId = toolId))
    val state: StateFlow<ToolWorkflowUiState> = _state.asStateFlow()

    init {
        // A source URI handed in from the viewer/hub pre-selects the input.
        savedStateHandle.get<String>(Routes.ARG_URI)?.takeIf { it.isNotBlank() }?.let { uri ->
            _state.update { it.copy(sources = listOf(uri), sourceNames = listOf(fileLabel(uri))) }
        }
    }

    val producesText: Boolean get() = toolId == PdfToolId.EXTRACT_TXT || toolId == PdfToolId.OCR

    // ── input + options ──────────────────────────────────────────────────────

    fun setSources(uris: List<String>, names: List<String>) =
        _state.update { it.copy(sources = uris, sourceNames = names, resultText = null, finished = false) }

    fun setQuality(v: Float) = _state.update { it.copy(quality = v) }
    fun setPassword(v: String) = _state.update { it.copy(password = v) }
    fun setDegrees(v: Int) = _state.update { it.copy(degrees = v) }
    fun setPageRange(v: String) = _state.update { it.copy(pageRange = v) }
    fun setWatermarkText(v: String) = _state.update { it.copy(watermarkText = v) }
    fun setOpacity(v: Float) = _state.update { it.copy(opacity = v) }
    fun setRotation(v: Float) = _state.update { it.copy(rotation = v) }
    fun setFontSize(v: Float) = _state.update { it.copy(fontSize = v) }
    fun setStartNumber(v: Int) = _state.update { it.copy(startNumber = v) }
    fun setPlacement(v: PageNumberPlacement) = _state.update { it.copy(placement = v) }
    fun setCreateText(v: String) = _state.update { it.copy(createText = v) }

    fun consumeMessage() = _state.update { it.copy(message = null) }

    /** True when the tool has everything it needs to run. */
    fun canRun(): Boolean {
        val s = _state.value
        return when (toolId) {
            PdfToolId.CREATE -> s.createText.isNotBlank()
            PdfToolId.MERGE -> s.sources.size >= 2
            PdfToolId.PROTECT, PdfToolId.UNLOCK -> s.sources.isNotEmpty() && s.password.isNotBlank()
            else -> s.sources.isNotEmpty()
        }
    }

    // ── execution ──────────────────────────────────────────────────────────

    /** Run a file-producing tool, streaming the result to [destinationUri]. */
    fun run(destinationUri: String) = viewModelScope.launch {
        if (!canRun()) {
            _state.update { it.copy(message = "Select a file to continue.", isError = true) }
            return@launch
        }
        _state.update { it.copy(isProcessing = true, message = null, isError = false, finished = false) }
        val result = dispatch(destinationUri)
        applyResult(result)
    }

    /** Run a text-producing tool (Extract TXT / OCR) and show the result inline. */
    fun runForText() = viewModelScope.launch {
        val s = _state.value
        if (s.sources.isEmpty()) {
            _state.update { it.copy(message = "Select a PDF to continue.", isError = true) }
            return@launch
        }
        _state.update { it.copy(isProcessing = true, message = null, isError = false) }
        val result = when (toolId) {
            PdfToolId.EXTRACT_TXT -> repo.extractText(s.sources.first())
            PdfToolId.OCR -> repo.ocr(s.sources.first())
            else -> Resource.Error("Unsupported")
        }
        when (result) {
            is Resource.Success ->
                _state.update { it.copy(isProcessing = false, resultText = result.data) }
            is Resource.Error ->
                _state.update { it.copy(isProcessing = false, message = result.message, isError = true) }
            Resource.Loading -> Unit
        }
    }

    fun saveResultText(destinationUri: String) = viewModelScope.launch {
        val text = _state.value.resultText ?: return@launch
        _state.update { it.copy(isProcessing = true) }
        applyResult(repo.saveText(text, destinationUri))
    }

    private suspend fun dispatch(dest: String): Resource<String> {
        val s = _state.value
        val first = s.sources.firstOrNull().orEmpty()
        return when (toolId) {
            PdfToolId.MERGE -> repo.merge(s.sources, dest)
            PdfToolId.SPLIT -> repo.split(first, s.pageRange, dest)
            PdfToolId.COMPRESS -> repo.compress(first, s.quality, dest)
            PdfToolId.PDF_TO_WORD -> repo.pdfToWord(first, dest)
            PdfToolId.PDF_TO_PPT -> repo.pdfToPowerpoint(first, dest)
            PdfToolId.PDF_TO_EXCEL -> repo.pdfToExcel(first, dest)
            PdfToolId.WORD_TO_PDF -> repo.officeToPdf(first, OfficeFormat.WORD, dest)
            PdfToolId.PPT_TO_PDF -> repo.officeToPdf(first, OfficeFormat.POWERPOINT, dest)
            PdfToolId.EXCEL_TO_PDF -> repo.officeToPdf(first, OfficeFormat.EXCEL, dest)
            PdfToolId.PDF_TO_JPG -> repo.pdfToImages(first, png = false, quality = (s.quality * 100).toInt(), destination = dest)
            PdfToolId.IMAGE_TO_PDF -> repo.imagesToPdf(s.sources, dest)
            PdfToolId.PAGE_NUMBERS -> repo.addPageNumbers(first, s.placement, s.startNumber, s.fontSize, dest)
            PdfToolId.WATERMARK -> repo.addWatermark(first, s.watermarkText, s.opacity, s.rotation, s.fontSize, dest)
            PdfToolId.ROTATE -> repo.rotateAll(first, s.degrees, dest)
            PdfToolId.UNLOCK -> repo.unlock(first, s.password, dest)
            PdfToolId.PROTECT -> repo.protect(first, s.password, dest)
            PdfToolId.REPAIR -> repo.repair(first, dest)
            PdfToolId.CREATE -> repo.createPdfFromText(s.createText, dest)
            PdfToolId.COMPRESS_IMAGE -> repo.compressImage(first, (s.quality * 100).toInt(), dest)
            PdfToolId.TO_JPG -> repo.convertImage(first, ImageOutputFormat.JPEG, dest)
            PdfToolId.FROM_JPG -> repo.convertImage(first, ImageOutputFormat.PNG, dest)
            else -> Resource.Error("This tool opens elsewhere")
        }
    }

    private fun applyResult(result: Resource<String>) {
        when (result) {
            is Resource.Success ->
                _state.update { it.copy(isProcessing = false, finished = true, isError = false, message = "Saved successfully.") }
            is Resource.Error ->
                _state.update { it.copy(isProcessing = false, message = result.message, isError = true) }
            Resource.Loading -> Unit
        }
    }

    // ── SAF descriptors ──────────────────────────────────────────────────────

    fun outputMime(): String = when (toolId) {
        PdfToolId.PDF_TO_WORD -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        PdfToolId.PDF_TO_EXCEL -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        PdfToolId.PDF_TO_PPT, PdfToolId.PDF_TO_JPG -> "application/zip"
        PdfToolId.TO_JPG, PdfToolId.COMPRESS_IMAGE -> "image/jpeg"
        PdfToolId.FROM_JPG -> "image/png"
        PdfToolId.EXTRACT_TXT, PdfToolId.OCR -> "text/plain"
        else -> "application/pdf"
    }

    fun defaultFileName(): String = when (toolId) {
        PdfToolId.MERGE -> "merged.pdf"
        PdfToolId.SPLIT -> "split.pdf"
        PdfToolId.COMPRESS -> "compressed.pdf"
        PdfToolId.PDF_TO_WORD -> "document.docx"
        PdfToolId.PDF_TO_EXCEL -> "spreadsheet.xlsx"
        PdfToolId.PDF_TO_PPT -> "slides.zip"
        PdfToolId.WORD_TO_PDF, PdfToolId.PPT_TO_PDF, PdfToolId.EXCEL_TO_PDF -> "converted.pdf"
        PdfToolId.PDF_TO_JPG -> "pages.zip"
        PdfToolId.IMAGE_TO_PDF -> "images.pdf"
        PdfToolId.PAGE_NUMBERS -> "numbered.pdf"
        PdfToolId.WATERMARK -> "watermarked.pdf"
        PdfToolId.ROTATE -> "rotated.pdf"
        PdfToolId.UNLOCK -> "unlocked.pdf"
        PdfToolId.PROTECT -> "protected.pdf"
        PdfToolId.REPAIR -> "repaired.pdf"
        PdfToolId.CREATE -> "created.pdf"
        PdfToolId.COMPRESS_IMAGE -> "compressed.jpg"
        PdfToolId.TO_JPG -> "image.jpg"
        PdfToolId.FROM_JPG -> "image.png"
        PdfToolId.EXTRACT_TXT -> "extracted.txt"
        PdfToolId.OCR -> "ocr.txt"
        else -> "output.pdf"
    }

    /** MIME filter(s) for the input picker. */
    fun inputMimeTypes(): Array<String> = when (toolId) {
        PdfToolId.IMAGE_TO_PDF, PdfToolId.COMPRESS_IMAGE, PdfToolId.TO_JPG, PdfToolId.FROM_JPG ->
            arrayOf("image/*")
        PdfToolId.WORD_TO_PDF ->
            arrayOf(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/msword", "text/plain", "application/rtf", "text/rtf"
            )
        PdfToolId.PPT_TO_PDF ->
            arrayOf(
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "application/vnd.ms-powerpoint"
            )
        PdfToolId.EXCEL_TO_PDF ->
            arrayOf(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-excel", "text/csv", "text/comma-separated-values"
            )
        else -> arrayOf("application/pdf")
    }

    private fun fileLabel(uri: String): String =
        uri.substringAfterLast('/').substringAfterLast("%2F").ifBlank { "Selected file" }
}
