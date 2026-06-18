package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.ui.graphics.Color
import com.vikingstech.masterpdf.domain.model.Bookmark
import com.vikingstech.masterpdf.domain.model.ChatMessage
import com.vikingstech.masterpdf.domain.model.CustomStamp
import com.vikingstech.masterpdf.domain.model.DrawingStroke
import com.vikingstech.masterpdf.domain.model.PdfDocument
import com.vikingstech.masterpdf.domain.model.PdfFormField
import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import com.vikingstech.masterpdf.domain.model.Signature
import com.vikingstech.masterpdf.domain.model.StampPlacement
import com.vikingstech.masterpdf.domain.model.StrokePoint

data class ViewerUiState(
    val isLoading: Boolean = true,
    val document: PdfDocument? = null,
    val pages: List<PdfPageInfo> = emptyList(),
    val error: String? = null,

    // ── Zoom (Feature 1) ──
    val zoomLevel: Float = 1f,

    // ── Freehand drawing ──
    val isDrawingMode: Boolean = false,
    val currentPageStrokes: List<DrawingStroke> = emptyList(),
    val currentStrokePath: List<StrokePoint> = emptyList(),
    val strokeColor: Color = Color.Black,
    val strokeWidth: Float = 2f,

    // ── Forms ──
    val formFields: List<PdfFormField> = emptyList(),
    val showFormPanel: Boolean = false,
    val formFieldValues: Map<String, String> = emptyMap(),

    // ── Stamps ──
    val availableStamps: List<CustomStamp> = emptyList(),
    val showStampDesigner: Boolean = false,
    val selectedStampForPlacement: String? = null,
    val stampPlacements: List<StampPlacement> = emptyList(),

    // ── Bookmarks (Feature 2) ──
    val bookmarks: List<Bookmark> = emptyList(),
    val showBookmarkPanel: Boolean = false,

    // ── AI chat (Feature 3) ──
    val showAiPanel: Boolean = false,
    val chatMessages: List<ChatMessage> = emptyList(),
    val isAiStreaming: Boolean = false,
    val aiInputText: String = "",

    // ── Signatures (Feature 5) ──
    val showSignatureCapture: Boolean = false,
    val signatures: List<Signature> = emptyList(),
    val signatureForPlacement: Signature? = null
)
