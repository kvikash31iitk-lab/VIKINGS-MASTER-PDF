package com.vikingstech.masterpdf.ui.tools

import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.MergeType
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Compress
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.RotateRight
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vikingstech.masterpdf.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ToolsScreen(
    onBack: () -> Unit,
    viewModel: ToolsViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.result, state.error) {
        val message = state.error ?: state.result
        if (message != null) {
            snackbar.showSnackbar(message)
            viewModel.clearMessages()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.documentName.ifBlank { stringResource(R.string.tools_title) }) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back))
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbar) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ToolCard(
                title = stringResource(R.string.tools_page_manager),
                icon = Icons.Filled.Layers,
                expanded = state.expandedSection == ToolSection.PAGE_MANAGER,
                onToggle = { viewModel.setExpanded(ToolSection.PAGE_MANAGER) }
            ) {
                if (state.hasDocument) {
                    PageManagerSection(state, viewModel)
                } else {
                    NoDocumentNote()
                }
            }

            ToolCard(
                title = stringResource(R.string.tools_rotate),
                icon = Icons.Filled.RotateRight,
                expanded = state.expandedSection == ToolSection.ROTATE,
                onToggle = { viewModel.setExpanded(ToolSection.ROTATE) }
            ) {
                if (state.hasDocument) RotateSection(state, viewModel) else NoDocumentNote()
            }

            ToolCard(
                title = stringResource(R.string.tools_compress),
                icon = Icons.Filled.Compress,
                expanded = state.expandedSection == ToolSection.COMPRESS,
                onToggle = { viewModel.setExpanded(ToolSection.COMPRESS) }
            ) {
                if (state.hasDocument) CompressSection(state, viewModel) else NoDocumentNote()
            }

            ToolCard(
                title = stringResource(R.string.tools_extract),
                icon = Icons.Filled.Article,
                expanded = state.expandedSection == ToolSection.EXTRACT,
                onToggle = { viewModel.setExpanded(ToolSection.EXTRACT) }
            ) {
                if (state.hasDocument) ExtractSection(state, viewModel) else NoDocumentNote()
            }

            ToolCard(
                title = stringResource(R.string.tools_merge),
                icon = Icons.AutoMirrored.Filled.MergeType,
                expanded = state.expandedSection == ToolSection.MERGE,
                onToggle = { viewModel.setExpanded(ToolSection.MERGE) }
            ) {
                MergeSection(state, viewModel)
            }

            if (state.isProcessing) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(8.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    Text(stringResource(R.string.tools_processing), modifier = Modifier.padding(start = 12.dp))
                }
            }
        }
    }
}

@Composable
private fun ToolCard(
    title: String,
    icon: ImageVector,
    expanded: Boolean,
    onToggle: () -> Unit,
    content: @Composable () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onToggle)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.weight(1f).padding(start = 12.dp)
            )
            Icon(
                if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                contentDescription = null
            )
        }
        AnimatedVisibility(visible = expanded) {
            Column(modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
                content()
            }
        }
    }
}

@Composable
private fun NoDocumentNote() {
    Text(
        text = stringResource(R.string.tools_no_document),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

// ── Page Manager ─────────────────────────────────────────────────────────────

@Composable
private fun PageManagerSection(state: ToolsUiState, viewModel: ToolsViewModel) {
    val slots = remember(state.pageCount) {
        mutableStateListOf<Int>().apply { addAll(0 until state.pageCount) }
    }
    val deleted = remember(state.pageCount) { mutableStateListOf<Int>() }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        slots.forEachIndexed { position, original ->
            val isDeleted = original in deleted
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ToolPageThumb(original, state.renderRevision, viewModel)
                Text(
                    text = stringResource(R.string.tools_page_label, original + 1),
                    textDecoration = if (isDeleted) TextDecoration.LineThrough else null,
                    modifier = Modifier.weight(1f).padding(start = 12.dp)
                )
                IconButton(
                    onClick = { if (position > 0) slots.swap(position, position - 1) },
                    enabled = position > 0
                ) {
                    Icon(Icons.Filled.KeyboardArrowUp, contentDescription = stringResource(R.string.cd_drag_handle))
                }
                IconButton(
                    onClick = { if (position < slots.size - 1) slots.swap(position, position + 1) },
                    enabled = position < slots.size - 1
                ) {
                    Icon(Icons.Filled.KeyboardArrowDown, contentDescription = stringResource(R.string.cd_drag_handle))
                }
                IconButton(onClick = {
                    if (isDeleted) deleted.remove(original) else deleted.add(original)
                }) {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = stringResource(R.string.tools_delete),
                        tint = if (isDeleted) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        val saveLauncher = rememberLauncherForActivityResult(
            ActivityResultContracts.CreateDocument("application/pdf")
        ) { uri -> uri?.let { viewModel.saveAs(it.toString()) } }

        val keptCount = slots.count { it !in deleted }
        if (keptCount == 0) {
            Text(
                text = stringResource(R.string.tools_page_delete_all),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = {
                    val keep = slots.filter { it !in deleted }
                    val del = slots.filter { it in deleted }
                    viewModel.applyPageEdits(keep, del)
                },
                enabled = keptCount > 0,
                modifier = Modifier.weight(1f)
            ) {
                Text(stringResource(R.string.viewer_apply))
            }
            OutlinedButton(
                onClick = { saveLauncher.launch("edited.pdf") },
                modifier = Modifier.weight(1f)
            ) {
                Text(stringResource(R.string.tools_save_as))
            }
        }
    }
}

// ── Rotate ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun RotateSection(state: ToolsUiState, viewModel: ToolsViewModel) {
    val selected = remember(state.pageCount) { mutableStateListOf<Int>() }
    var degrees by remember { mutableIntStateOf(90) }
    val options = listOf(90, 180, 270)

    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        (0 until state.pageCount).forEach { index ->
            FilterChip(
                selected = index in selected,
                onClick = { if (index in selected) selected.remove(index) else selected.add(index) },
                label = { Text(stringResource(R.string.tools_page_label, index + 1)) }
            )
        }
    }

    SingleChoiceSegmentedButtonRow(modifier = Modifier.padding(top = 12.dp)) {
        options.forEachIndexed { i, deg ->
            SegmentedButton(
                selected = degrees == deg,
                onClick = { degrees = deg },
                shape = SegmentedButtonDefaults.itemShape(index = i, count = options.size)
            ) {
                Text("$deg°")
            }
        }
    }

    Button(
        onClick = { viewModel.rotate(selected.toList(), degrees) },
        enabled = selected.isNotEmpty(),
        modifier = Modifier.padding(top = 12.dp)
    ) {
        Text(stringResource(R.string.tools_rotate_apply))
    }
}

// ── Compress ─────────────────────────────────────────────────────────────────

@Composable
private fun CompressSection(state: ToolsUiState, viewModel: ToolsViewModel) {
    var quality by remember { mutableFloatStateOf(0.7f) }
    val label = when {
        quality < 0.5f -> stringResource(R.string.tools_quality_low)
        quality < 0.8f -> stringResource(R.string.tools_quality_balanced)
        else -> stringResource(R.string.tools_quality_high)
    }
    val compressLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/pdf")
    ) { uri -> uri?.let { viewModel.compress(quality, it.toString()) } }

    Text("${stringResource(R.string.tools_quality)}: $label")
    Slider(value = quality, onValueChange = { quality = it }, valueRange = 0.3f..1.0f)
    Button(onClick = { compressLauncher.launch("compressed.pdf") }) {
        Text(stringResource(R.string.tools_compress_run))
    }
}

// ── Extract text ─────────────────────────────────────────────────────────────

@Composable
private fun ExtractSection(state: ToolsUiState, viewModel: ToolsViewModel) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val text = state.extractedText

    Button(onClick = viewModel::extractText) { Text(stringResource(R.string.tools_extract_run)) }

    if (text != null) {
        OutlinedTextField(
            value = text,
            onValueChange = {},
            readOnly = true,
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
                .padding(top = 8.dp)
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(onClick = { clipboard.setText(AnnotatedString(text)) }) {
                Icon(Icons.Filled.ContentCopy, contentDescription = null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.tools_extract_copy), modifier = Modifier.padding(start = 6.dp))
            }
            OutlinedButton(onClick = {
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                context.startActivity(Intent.createChooser(send, null))
            }) {
                Icon(Icons.Filled.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.tools_extract_share), modifier = Modifier.padding(start = 6.dp))
            }
        }
    }
}

// ── Merge ────────────────────────────────────────────────────────────────────

@Composable
private fun MergeSection(state: ToolsUiState, viewModel: ToolsViewModel) {
    val context = LocalContext.current

    val pickLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments()
    ) { uris ->
        if (uris.isNotEmpty()) {
            val files = uris.map { uri ->
                runCatching {
                    context.contentResolver.takePersistableUriPermission(
                        uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
                    )
                }
                MergeFile(uri = uri.toString(), name = queryDisplayName(context, uri))
            }
            viewModel.addMergeFiles(files)
        }
    }
    val mergeLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/pdf")
    ) { uri -> uri?.let { viewModel.merge(it.toString()) } }

    OutlinedButton(onClick = { pickLauncher.launch(arrayOf("application/pdf")) }) {
        Text(stringResource(R.string.tools_merge_pick))
    }

    Column(modifier = Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        state.mergeFiles.forEachIndexed { index, file ->
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "${index + 1}. ${file.name}",
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                IconButton(
                    onClick = { viewModel.moveMergeFile(index, index - 1) },
                    enabled = index > 0
                ) { Icon(Icons.Filled.KeyboardArrowUp, contentDescription = stringResource(R.string.cd_drag_handle)) }
                IconButton(
                    onClick = { viewModel.moveMergeFile(index, index + 1) },
                    enabled = index < state.mergeFiles.size - 1
                ) { Icon(Icons.Filled.KeyboardArrowDown, contentDescription = stringResource(R.string.cd_drag_handle)) }
                IconButton(onClick = { viewModel.removeMergeFile(index) }) {
                    Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.tools_delete))
                }
            }
        }
    }

    Button(
        onClick = { mergeLauncher.launch("merged.pdf") },
        enabled = state.mergeFiles.size >= 2,
        modifier = Modifier.padding(top = 8.dp)
    ) {
        Text(stringResource(R.string.tools_merge_run))
    }
}

// ── shared bits ──────────────────────────────────────────────────────────────

@Composable
private fun ToolPageThumb(pageIndex: Int, revision: Int, viewModel: ToolsViewModel) {
    val density = LocalDensity.current
    val widthPx = with(density) { 36.dp.roundToPx() }
    var bitmap by remember(pageIndex, revision) { mutableStateOf<Bitmap?>(null) }
    LaunchedEffect(pageIndex, revision) { bitmap = viewModel.renderPage(pageIndex, widthPx) }

    Box(
        modifier = Modifier
            .size(width = 36.dp, height = 46.dp)
            .background(Color.White, RoundedCornerShape(2.dp)),
        contentAlignment = Alignment.Center
    ) {
        bitmap?.let {
            Image(bitmap = it.asImageBitmap(), contentDescription = null)
        }
    }
}

private fun MutableList<Int>.swap(a: Int, b: Int) {
    val tmp = this[a]
    this[a] = this[b]
    this[b] = tmp
}

private fun queryDisplayName(context: android.content.Context, uri: Uri): String {
    var name = uri.lastPathSegment ?: "document.pdf"
    runCatching {
        context.contentResolver.query(uri, null, null, null, null)?.use { c ->
            val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (c.moveToFirst() && idx >= 0) c.getString(idx)?.let { name = it }
        }
    }
    return name
}
