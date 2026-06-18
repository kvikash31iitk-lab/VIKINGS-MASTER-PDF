package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.DrawOutlined
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.ui.components.EmptyState
import com.vikingstech.masterpdf.ui.components.VikingsLoadingBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ViewerScreen(
    onBack: () -> Unit,
    viewModel: ViewerViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    val currentPage = remember(state.pages) {
        derivedCurrentPage(listState)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = state.document?.name ?: stringResource(R.string.viewer_loading),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back)
                        )
                    }
                },
                actions = {
                    if (!state.isDrawingMode) {
                        state.document?.let { doc ->
                            Text(
                                text = "${currentPage()}/${doc.pageCount}",
                                style = MaterialTheme.typography.labelLarge,
                                modifier = Modifier.padding(end = 16.dp)
                            )
                        }
                    }
                    IconButton(onClick = { viewModel.toggleDrawingMode() }) {
                        Icon(
                            Icons.Filled.DrawOutlined,
                            contentDescription = "Draw",
                            tint = if (state.isDrawingMode) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            )
        },
        bottomBar = {
            if (state.isDrawingMode) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 8.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        IconButton(
                            onClick = { viewModel.clearStrokes() },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Filled.DeleteOutline, contentDescription = "Clear")
                        }
                        IconButton(
                            onClick = { viewModel.commitStrokes() },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Filled.Check, contentDescription = "Commit")
                        }
                        IconButton(
                            onClick = { viewModel.toggleDrawingMode() },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Filled.Close, contentDescription = "Close")
                        }
                    }
                }
            }
        }
    ) { padding ->
        when {
            state.isLoading -> VikingsLoadingBar(
                modifier = Modifier.fillMaxSize().padding(padding),
                message = stringResource(R.string.viewer_loading)
            )

            state.error != null -> EmptyState(
                icon = Icons.Filled.ErrorOutline,
                title = stringResource(R.string.viewer_error),
                subtitle = state.error,
                modifier = Modifier.fillMaxSize().padding(padding)
            )

            else -> LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(state.pages, key = { it.index }) { page ->
                    PdfPageItem(
                        page = page,
                        render = viewModel::renderPage,
                        strokes = state.currentPageStrokes,
                        currentPath = state.currentStrokePath,
                        strokeColor = state.strokeColor,
                        strokeWidth = state.strokeWidth,
                        isDrawingEnabled = state.isDrawingMode,
                        onPointAdded = { viewModel.addPointToCurrentStroke(it) },
                        onStrokeFinished = { viewModel.finishStroke() }
                    )
                }
            }
        }
    }
}

/** First visible item index (1-based) for the page counter. */
private fun derivedCurrentPage(
    listState: androidx.compose.foundation.lazy.LazyListState
): () -> Int = { listState.firstVisibleItemIndex + 1 }
