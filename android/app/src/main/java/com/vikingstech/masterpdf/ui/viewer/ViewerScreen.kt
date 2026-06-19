package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Draw
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Gesture
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.TextFields
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.ZoomOutMap
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.ui.components.EmptyState
import com.vikingstech.masterpdf.ui.components.StampDesignerDialog
import com.vikingstech.masterpdf.ui.components.VikingsLoadingBar
import kotlinx.coroutines.flow.distinctUntilChanged

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ViewerScreen(
    onBack: () -> Unit,
    onOpenTools: (String) -> Unit,
    viewModel: ViewerViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    val configuration = LocalConfiguration.current
    val isTablet = configuration.screenWidthDp >= 600

    val currentPage = listState.firstVisibleItemIndex
    var immersiveMode by remember { mutableStateOf(false) }

    // Persist scroll position for "Continue Reading".
    LaunchedEffect(listState) {
        snapshotFlowOfFirstVisible(listState).collect { viewModel.onPageChanged(it) }
    }

    // Honour jump-to-page requests (bookmarks + startPage restore).
    LaunchedEffect(Unit) {
        viewModel.jumpToPageEvent.collect { index -> listState.animateScrollToItem(index) }
    }

    Scaffold { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            Row(modifier = Modifier.fillMaxSize()) {
                val phoneAiTakeover = state.showAiPanel && !isTablet
                if (!phoneAiTakeover) {
                    Box(modifier = Modifier.weight(1f).fillMaxSize()) {
                        ViewerContent(
                            state = state,
                            listState = listState,
                            viewModel = viewModel,
                            onToggleImmersive = { immersiveMode = !immersiveMode }
                        )
                    }
                }

                if (state.showFormPanel && state.formFields.isNotEmpty() && !state.showAiPanel) {
                    Surface(
                        modifier = Modifier
                            .width(if (isTablet) 360.dp else 280.dp)
                            .fillMaxHeight(),
                        color = MaterialTheme.colorScheme.surface,
                        tonalElevation = 4.dp
                    ) {
                        FormFieldPanel(
                            fields = state.formFields,
                            fieldValues = state.formFieldValues,
                            onFieldValueChanged = viewModel::updateFormFieldValue,
                            onFieldSubmitted = viewModel::submitFormField
                        )
                    }
                }

                if (state.showAiPanel) {
                    AiChatPanel(
                        messages = state.chatMessages,
                        inputText = state.aiInputText,
                        isStreaming = state.isAiStreaming,
                        onInputChange = viewModel::setAiInput,
                        onSend = viewModel::sendAiMessage,
                        onClear = viewModel::clearConversation,
                        onClose = viewModel::toggleAiPanel,
                        modifier = if (isTablet) {
                            Modifier.width(360.dp).fillMaxHeight()
                        } else {
                            Modifier.weight(1f).fillMaxSize()
                        }
                    )
                }
            }

            // Floating Top App Bar with slide transitions
            AnimatedVisibility(
                visible = !immersiveMode,
                enter = slideInVertically(animationSpec = spring(dampingRatio = 0.8f, stiffness = 300f)) { -it } + fadeIn(),
                exit = slideOutVertically(animationSpec = spring(dampingRatio = 0.8f, stiffness = 300f)) { -it } + fadeOut(),
                modifier = Modifier.align(Alignment.TopCenter)
            ) {
                ViewerTopBar(
                    title = state.document?.name ?: stringResource(R.string.viewer_loading),
                    pageLabel = state.document?.let { "${currentPage + 1}/${it.pageCount}" },
                    showPageLabel = false, // Handled by bottom indicator pill
                    zoomedIn = state.zoomLevel > 1.05f,
                    bookmarkCount = state.bookmarks.size,
                    hasForms = state.formFields.isNotEmpty(),
                    aiActive = state.showAiPanel,
                    onBack = onBack,
                    onResetZoom = viewModel::resetZoom,
                    onBookmarks = viewModel::toggleBookmarkPanel,
                    onAi = viewModel::toggleAiPanel,
                    onDraw = viewModel::toggleDrawingMode,
                    onSignature = viewModel::toggleSignatureCapture,
                    onStamps = viewModel::toggleStampDesigner,
                    onForms = viewModel::toggleFormPanel,
                    onTools = { state.document?.uri?.let(onOpenTools) }
                )
            }

            // Floating Annotation Dock for Drawing Mode
            AnimatedVisibility(
                visible = !immersiveMode && state.isDrawingMode,
                enter = slideInVertically(animationSpec = spring(dampingRatio = 0.8f, stiffness = 300f)) { it } + fadeIn(),
                exit = slideOutVertically(animationSpec = spring(dampingRatio = 0.8f, stiffness = 300f)) { it } + fadeOut(),
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 16.dp)
            ) {
                DrawingDock(
                    currentColor = state.strokeColor,
                    currentWidth = state.strokeWidth,
                    onColorSelected = viewModel::setStrokeColor,
                    onWidthSelected = viewModel::setStrokeWidth,
                    onClear = viewModel::clearStrokes,
                    onApply = viewModel::commitStrokes,
                    onClose = viewModel::toggleDrawingMode
                )
            }

            // Floating Page & Zoom Indicator Pill
            AnimatedVisibility(
                visible = !immersiveMode && !state.isDrawingMode,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(16.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(99.dp),
                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.85f),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                    shadowElevation = 4.dp
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Page ${currentPage + 1} of ${state.pages.size}",
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Box(
                            modifier = Modifier
                                .size(width = 1.dp, height = 12.dp)
                                .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
                        )
                        Text(
                            text = "${(state.zoomLevel * 100).toInt()}%",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            ),
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            // Signature placement floats above the page content.
            state.signatureForPlacement?.let { sig ->
                SignaturePlacerOverlay(
                    signature = sig,
                    onCommit = { nx, ny, nw, nh ->
                        viewModel.commitSignature(currentPage, nx, ny, nw, nh)
                    },
                    onCancel = viewModel::clearSignaturePlacement
                )
            }
        }
    }

    if (state.showStampDesigner) {
        StampDesignerDialog(
            onDismiss = viewModel::toggleStampDesigner,
            onSave = viewModel::saveNewStamp
        )
    }

    if (state.showSignatureCapture) {
        SignatureCaptureDialog(
            savedSignatures = state.signatures,
            onSave = viewModel::saveSignature,
            onSelectExisting = viewModel::selectSignatureForPlacement,
            onDismiss = viewModel::toggleSignatureCapture
        )
    }

    if (state.showBookmarkPanel) {
        BookmarkPanel(
            bookmarks = state.bookmarks,
            currentPage = currentPage,
            render = viewModel::renderPage,
            onJumpToPage = viewModel::jumpToPage,
            onDeleteBookmark = viewModel::deleteBookmark,
            onAddBookmark = { label -> viewModel.addBookmark(currentPage, label) },
            onDismiss = viewModel::toggleBookmarkPanel
        )
    }
}

@Composable
private fun ViewerContent(
    state: ViewerUiState,
    listState: androidx.compose.foundation.lazy.LazyListState,
    viewModel: ViewerViewModel,
    onToggleImmersive: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    
    when {
        state.isLoading -> VikingsLoadingBar(
            modifier = Modifier.fillMaxSize(),
            message = stringResource(R.string.viewer_loading)
        )

        state.error != null -> EmptyState(
            icon = Icons.Filled.ErrorOutline,
            title = stringResource(R.string.viewer_error),
            subtitle = state.error,
            modifier = Modifier.fillMaxSize()
        )

        else -> LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = 84.dp, bottom = 96.dp, start = 12.dp, end = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(state.pages, key = { it.index }) { page ->
                PdfPageItem(
                    page = page,
                    render = viewModel::renderPage,
                    zoomResetEvents = viewModel.zoomResetEvents,
                    onZoomChanged = viewModel::onZoomChanged,
                    strokes = state.currentPageStrokes,
                    currentPath = state.currentStrokePath,
                    strokeColor = state.strokeColor,
                    strokeWidth = state.strokeWidth,
                    isDrawingEnabled = state.isDrawingMode,
                    onPointAdded = viewModel::addPointToCurrentStroke,
                    onStrokeFinished = viewModel::finishStroke,
                    modifier = Modifier
                        .shadow(2.dp, RoundedCornerShape(4.dp))
                        .clickable(
                            interactionSource = interactionSource,
                            indication = null,
                            enabled = !state.isDrawingMode,
                            onClick = onToggleImmersive
                        )
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ViewerTopBar(
    title: String,
    pageLabel: String?,
    showPageLabel: Boolean,
    zoomedIn: Boolean,
    bookmarkCount: Int,
    hasForms: Boolean,
    aiActive: Boolean,
    onBack: () -> Unit,
    onResetZoom: () -> Unit,
    onBookmarks: () -> Unit,
    onAi: () -> Unit,
    onDraw: () -> Unit,
    onSignature: () -> Unit,
    onStamps: () -> Unit,
    onForms: () -> Unit,
    onTools: () -> Unit
) {
    var menuOpen by remember { mutableStateOf(false) }

    Surface(
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f),
        tonalElevation = 4.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        TopAppBar(
            title = { Text(text = title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Bold) },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back))
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Color.Transparent
            ),
            actions = {
                if (showPageLabel && pageLabel != null) {
                    Text(
                        text = pageLabel,
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.padding(end = 8.dp)
                    )
                }
                if (zoomedIn) {
                    IconButton(onClick = onResetZoom) {
                        Icon(Icons.Filled.ZoomOutMap, contentDescription = stringResource(R.string.viewer_zoom_reset))
                    }
                }
                IconButton(onClick = onBookmarks) {
                    BadgedBox(badge = { if (bookmarkCount > 0) Badge { Text("$bookmarkCount") } }) {
                        Icon(Icons.Filled.Bookmark, contentDescription = stringResource(R.string.viewer_bookmarks))
                    }
                }
                IconButton(onClick = onAi) {
                    Icon(
                        Icons.Filled.SmartToy,
                        contentDescription = stringResource(R.string.viewer_ai),
                        tint = if (aiActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton(onClick = { menuOpen = true }) {
                    Icon(Icons.Filled.MoreVert, contentDescription = stringResource(R.string.viewer_more))
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.viewer_draw)) },
                        leadingIcon = { Icon(Icons.Filled.Gesture, contentDescription = null) },
                        onClick = { menuOpen = false; onDraw() }
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.viewer_signature)) },
                        leadingIcon = { Icon(Icons.Filled.Draw, contentDescription = null) },
                        onClick = { menuOpen = false; onSignature() }
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.viewer_stamps)) },
                        leadingIcon = { Icon(Icons.Filled.LocalOffer, contentDescription = null) },
                        onClick = { menuOpen = false; onStamps() }
                    )
                    if (hasForms) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.viewer_forms)) },
                            leadingIcon = { Icon(Icons.Filled.TextFields, contentDescription = null) },
                            onClick = { menuOpen = false; onForms() }
                        )
                    }
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.viewer_tools)) },
                        leadingIcon = { Icon(Icons.Filled.Tune, contentDescription = null) },
                        onClick = { menuOpen = false; onTools() }
                    )
                }
            }
        )
    }
}

@Composable
private fun DrawingDock(
    currentColor: Color,
    currentWidth: Float,
    onColorSelected: (Color) -> Unit,
    onWidthSelected: (Float) -> Unit,
    onClear: () -> Unit,
    onApply: () -> Unit,
    onClose: () -> Unit
) {
    Surface(
        modifier = Modifier
            .padding(16.dp)
            .shadow(12.dp, RoundedCornerShape(24.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f), RoundedCornerShape(24.dp)),
        shape = RoundedCornerShape(24.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f)
    ) {
        Column(
            modifier = Modifier
                .width(280.dp)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Markup Tools",
                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.primary
                )
                IconButton(onClick = onClose, modifier = Modifier.size(24.dp)) {
                    Icon(
                        imageVector = Icons.Filled.Close, 
                        contentDescription = "Close drawing mode",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            
            // Color selectors
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val colors = listOf(
                    Color(0xFF3B82F6), // Blue
                    Color(0xFFEF4444), // Red
                    Color(0xFF10B981), // Green
                    Color(0xFFF59E0B), // Orange
                    Color.Black,
                    Color.White
                )
                colors.forEach { color ->
                    val isSelected = currentColor == color
                    Box(
                        modifier = Modifier
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(color)
                            .border(
                                width = if (isSelected) 3.dp else 1.dp,
                                color = if (isSelected) MaterialTheme.colorScheme.primary else Color.Gray.copy(alpha = 0.4f),
                                shape = CircleShape
                            )
                            .clickable { onColorSelected(color) }
                    )
                }
            }
            Spacer(Modifier.height(14.dp))

            // Line width slider
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Size", 
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold), 
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(end = 12.dp)
                )
                Slider(
                    value = currentWidth,
                    onValueChange = onWidthSelected,
                    valueRange = 1f..15f,
                    modifier = Modifier.weight(1f)
                )
                Box(
                    modifier = Modifier
                        .padding(start = 12.dp)
                        .size(18.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(currentWidth.coerceIn(2f, 16f).dp)
                            .clip(CircleShape)
                            .background(currentColor)
                    )
                }
            }
            Spacer(Modifier.height(14.dp))

            // Undo / Apply actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(
                    onClick = onClear,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
                ) {
                    Icon(
                        imageVector = Icons.Filled.DeleteOutline, 
                        contentDescription = null, 
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "Clear", 
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Button(
                    onClick = onApply,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.Check, 
                        contentDescription = null, 
                        modifier = Modifier.size(16.dp),
                        tint = Color.White
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "Apply", 
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        }
    }
}

/** First visible item index as a distinct-until-changed flow. */
private fun snapshotFlowOfFirstVisible(listState: androidx.compose.foundation.lazy.LazyListState) =
    androidx.compose.runtime.snapshotFlow { listState.firstVisibleItemIndex }.distinctUntilChanged()
