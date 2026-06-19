package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
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
    val snackbar = remember { SnackbarHostState() }

    val currentPage = listState.firstVisibleItemIndex

    // Persist scroll position for "Continue Reading".
    LaunchedEffect(listState) {
        snapshotFlowOfFirstVisible(listState).collect { viewModel.onPageChanged(it) }
    }

    // Honour jump-to-page requests (bookmarks + startPage restore).
    LaunchedEffect(Unit) {
        viewModel.jumpToPageEvent.collect { index -> listState.animateScrollToItem(index) }
    }

    // Surface one-shot feedback (form saved, stamp applied, errors…).
    LaunchedEffect(state.userMessage) {
        state.userMessage?.let {
            snackbar.showSnackbar(it)
            viewModel.consumeUserMessage()
        }
    }

    Scaffold(
        topBar = {
            ViewerTopBar(
                title = state.document?.name ?: stringResource(R.string.viewer_loading),
                pageLabel = state.document?.let { "${currentPage + 1}/${it.pageCount}" },
                showPageLabel = !state.isDrawingMode,
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
                onStamps = viewModel::toggleStampPicker,
                onForms = viewModel::toggleFormPanel,
                onTools = { state.document?.uri?.let(onOpenTools) }
            )
        },
        bottomBar = {
            if (state.isDrawingMode) DrawingToolbar(viewModel)
        },
        snackbarHost = { SnackbarHost(snackbar) }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(modifier = Modifier.fillMaxSize()) {
                val phoneAiTakeover = state.showAiPanel && !isTablet
                if (!phoneAiTakeover) {
                    Box(modifier = Modifier.weight(1f).fillMaxSize()) {
                        ViewerContent(state, listState, viewModel)
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
                            isSaving = state.isSavingForm,
                            onFieldValueChanged = viewModel::updateFormFieldValue,
                            onFieldSubmitted = viewModel::submitFormField,
                            onApplyAll = viewModel::applyAllFormFields
                        )
                    }
                }

                if (state.showAiPanel) {
                    AiChatPanel(
                        messages = state.chatMessages,
                        inputText = state.aiInputText,
                        isStreaming = state.isAiStreaming || state.isExtractingContext,
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
        }
    }

    if (state.showStampPicker) {
        StampPickerDialog(
            stamps = state.availableStamps,
            onSelect = viewModel::beginStampPlacement,
            onCreateNew = viewModel::openStampDesigner,
            onDismiss = viewModel::toggleStampPicker
        )
    }

    if (state.showStampDesigner) {
        StampDesignerDialog(
            onDismiss = viewModel::closeStampDesigner,
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
    viewModel: ViewerViewModel
) {
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
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(state.pages, key = { it.index }) { page ->
                val signature = state.signatureForPlacement
                val stamp = state.placementStamp
                val isPlacementTarget = page.index == state.placementPage
                PdfPageItem(
                    page = page,
                    renderRevision = state.renderRevision,
                    render = viewModel::renderPage,
                    zoomResetEvents = viewModel.zoomResetEvents,
                    onZoomChanged = viewModel::onZoomChanged,
                    strokes = state.pageStrokes[page.index].orEmpty(),
                    currentPath = if (state.activeDrawPage == page.index) state.currentStrokePath else emptyList(),
                    strokeColor = state.strokeColor,
                    strokeWidth = state.strokeWidth,
                    isDrawingEnabled = state.isDrawingMode,
                    onPointAdded = { point -> viewModel.addPointToCurrentStroke(page.index, point) },
                    onStrokeFinished = { viewModel.finishStroke(page.index) },
                    placementOverlay = {
                        when {
                            signature != null && isPlacementTarget -> SignaturePlacerOverlay(
                                signature = signature,
                                onCommit = { nx, ny, nw, nh -> viewModel.commitSignature(nx, ny, nw, nh) },
                                onCancel = viewModel::clearSignaturePlacement
                            )
                            stamp != null && isPlacementTarget -> StampPlacerOverlay(
                                stamp = stamp,
                                onCommit = { nx, ny, nw, nh -> viewModel.commitStampPlacement(nx, ny, nw, nh) },
                                onCancel = viewModel::cancelStampPlacement
                            )
                        }
                    }
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

    TopAppBar(
        title = { Text(text = title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        navigationIcon = {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back))
            }
        },
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

@Composable
private fun DrawingToolbar(viewModel: ViewerViewModel) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 8.dp
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            IconButton(onClick = viewModel::clearStrokes, modifier = Modifier.weight(1f)) {
                Icon(Icons.Filled.DeleteOutline, contentDescription = stringResource(R.string.viewer_clear))
            }
            IconButton(onClick = viewModel::commitStrokes, modifier = Modifier.weight(1f)) {
                Icon(Icons.Filled.Check, contentDescription = stringResource(R.string.viewer_apply))
            }
            IconButton(onClick = viewModel::toggleDrawingMode, modifier = Modifier.weight(1f)) {
                Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.cd_close))
            }
        }
    }
}

/** First visible item index as a distinct-until-changed flow. */
private fun snapshotFlowOfFirstVisible(listState: androidx.compose.foundation.lazy.LazyListState) =
    androidx.compose.runtime.snapshotFlow { listState.firstVisibleItemIndex }.distinctUntilChanged()
