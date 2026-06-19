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
import com.vikingstech.masterpdf.domain.model.StrokePoint

data class ViewerUiState(
    val isLoading: Boolean = true,
    val document: PdfDocument? = null,
    val pages: List<PdfPageInfo> = emptyList(),
    val error: String? = null,

    /**
     * Bumped after every successful PDF mutation. The viewer keys its page
     * bitmaps on this so edits become visible immediately instead of showing a
     * stale cached render until the page is reopened.
     */
    val renderRevision: Int = 0,

    /** First visible page; the default target for signature/stamp placement. */
    val currentPage: Int = 0,

    /** Transient one-shot feedback (e.g. "Form saved") surfaced via snackbar. */
    val userMessage: String? = null,

    // ── Zoom (Feature 1) ──
    val zoomLevel: Float = 1f,

    // ── Freehand drawing (per-page; points are 0..1 fractions of the page box) ──
    val isDrawingMode: Boolean = false,
    val pageStrokes: Map<Int, List<DrawingStroke>> = emptyMap(),
    val activeDrawPage: Int? = null,
    val currentStrokePath: List<StrokePoint> = emptyList(),
    val strokeColor: Color = Color.Black,
    val strokeWidth: Float = 2f,

    // ── Forms ──
    val formFields: List<PdfFormField> = emptyList(),
    val showFormPanel: Boolean = false,
    val formFieldValues: Map<String, String> = emptyMap(),
    val isSavingForm: Boolean = false,

    // ── Stamps ──
    val availableStamps: List<CustomStamp> = emptyList(),
    val showStampDesigner: Boolean = false,
    val showStampPicker: Boolean = false,
    /** Stamp currently being positioned on [placementPage]; null when inactive. */
    val placementStamp: CustomStamp? = null,

    // ── Bookmarks (Feature 2) ──
    val bookmarks: List<Bookmark> = emptyList(),
    val showBookmarkPanel: Boolean = false,

    // ── AI chat (Feature 3) ──
    val showAiPanel: Boolean = false,
    val chatMessages: List<ChatMessage> = emptyList(),
    val isAiStreaming: Boolean = false,
    val isExtractingContext: Boolean = false,
    val aiInputText: String = "",

    // ── Signatures (Feature 5) ──
    val showSignatureCapture: Boolean = false,
    val signatures: List<Signature> = emptyList(),
    val signatureForPlacement: Signature? = null,

    /** Page index that an active signature/stamp placement will commit onto. */
    val placementPage: Int = 0
)
