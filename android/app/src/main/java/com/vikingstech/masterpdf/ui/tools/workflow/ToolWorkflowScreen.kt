package com.vikingstech.masterpdf.ui.tools.workflow

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.domain.model.PageNumberPlacement
import com.vikingstech.masterpdf.ui.tools.PdfToolId
import com.vikingstech.masterpdf.ui.tools.PdfToolRegistry
import com.vikingstech.masterpdf.ui.tools.ToolInput
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ToolWorkflowScreen(
    onBack: () -> Unit,
    viewModel: ToolWorkflowViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val tool = remember(state.toolId) { PdfToolRegistry.byId(state.toolId) }
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbar.showSnackbar(it)
            viewModel.consumeMessage()
        }
    }

    val allowMultiple = state.toolId == PdfToolId.MERGE || state.toolId == PdfToolId.IMAGE_TO_PDF

    val pickSingle = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let {
            persist(context, it)
            viewModel.setSources(listOf(it.toString()), listOf(queryName(context, it)))
        }
    }
    val pickMultiple = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if (uris.isNotEmpty()) {
            uris.forEach { persist(context, it) }
            viewModel.setSources(uris.map { it.toString() }, uris.map { queryName(context, it) })
        }
    }
    val saveOutput = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument(viewModel.outputMime())
    ) { uri -> uri?.let { viewModel.run(it.toString()) } }
    val saveTxt = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("text/plain")
    ) { uri -> uri?.let { viewModel.saveResultText(it.toString()) } }

    fun launchPicker() {
        if (allowMultiple) pickMultiple.launch(viewModel.inputMimeTypes())
        else pickSingle.launch(viewModel.inputMimeTypes())
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(tool.titleRes)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back))
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbar) }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = stringResource(tool.descriptionRes),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (tool.input != ToolInput.NONE) {
                    SourceSection(state = state, input = tool.input, onPick = { launchPicker() })
                }

                OptionsSection(state, viewModel)

                if (viewModel.producesText) {
                    Button(
                        onClick = { viewModel.runForText() },
                        enabled = state.sources.isNotEmpty() && !state.isProcessing,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(stringResource(R.string.twf_run_text)) }

                    state.resultText?.let { ResultTextSection(it, onSaveTxt = { saveTxt.launch("export.txt") }, context = context) }
                } else {
                    Button(
                        onClick = { saveOutput.launch(viewModel.defaultFileName()) },
                        enabled = viewModel.canRun() && !state.isProcessing,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(stringResource(R.string.twf_run)) }
                }

                if (state.toolId == PdfToolId.PDF_TO_PPT) Hint(stringResource(R.string.twf_note_pptx))
                if (state.toolId == PdfToolId.OCR) Hint(stringResource(R.string.twf_note_ocr))
            }

            if (state.isProcessing) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Card {
                        Row(
                            modifier = Modifier.padding(20.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                            Text(stringResource(R.string.twf_processing), modifier = Modifier.padding(start = 14.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SourceSection(state: ToolWorkflowUiState, input: ToolInput, onPick: () -> Unit) {
    val labelRes = when (input) {
        ToolInput.MULTI_PDF -> R.string.twf_pick_pdfs
        ToolInput.IMAGES -> R.string.twf_pick_images
        ToolInput.OFFICE_DOC -> R.string.twf_pick_office
        else -> R.string.twf_pick_pdf
    }
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onPick, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Filled.UploadFile, contentDescription = null, modifier = Modifier.size(18.dp))
                Text(
                    text = if (state.sources.isEmpty()) stringResource(labelRes) else stringResource(R.string.twf_change_file),
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
            if (state.sources.isEmpty()) {
                Text(
                    text = stringResource(R.string.twf_no_source),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                Text(
                    text = stringResource(R.string.twf_selected_count, state.sources.size),
                    style = MaterialTheme.typography.labelMedium
                )
                state.sourceNames.take(6).forEach { name ->
                    Text("• $name", style = MaterialTheme.typography.bodySmall, maxLines = 1)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OptionsSection(state: ToolWorkflowUiState, vm: ToolWorkflowViewModel) {
    when (state.toolId) {
        PdfToolId.COMPRESS, PdfToolId.PDF_TO_JPG, PdfToolId.COMPRESS_IMAGE -> {
            QualitySlider(state.quality) { vm.setQuality(it) }
        }
        PdfToolId.SPLIT -> {
            OutlinedTextField(
                value = state.pageRange,
                onValueChange = vm::setPageRange,
                label = { Text(stringResource(R.string.twf_page_range)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
        PdfToolId.ROTATE -> {
            val options = listOf(90, 180, 270)
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                options.forEachIndexed { i, deg ->
                    SegmentedButton(
                        selected = state.degrees == deg,
                        onClick = { vm.setDegrees(deg) },
                        shape = SegmentedButtonDefaults.itemShape(index = i, count = options.size)
                    ) { Text("$deg°") }
                }
            }
        }
        PdfToolId.PROTECT, PdfToolId.UNLOCK -> {
            OutlinedTextField(
                value = state.password,
                onValueChange = vm::setPassword,
                label = { Text(stringResource(R.string.twf_password)) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth()
            )
        }
        PdfToolId.PAGE_NUMBERS -> {
            PlacementDropdown(state.placement) { vm.setPlacement(it) }
            IntField(stringResource(R.string.twf_start_number), state.startNumber) { vm.setStartNumber(it) }
            FloatField(stringResource(R.string.twf_font_size), state.fontSize) { vm.setFontSize(it) }
        }
        PdfToolId.WATERMARK -> {
            OutlinedTextField(
                value = state.watermarkText,
                onValueChange = vm::setWatermarkText,
                label = { Text(stringResource(R.string.twf_watermark_text)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            LabeledSlider(
                label = stringResource(R.string.twf_opacity),
                valueText = "${(state.opacity * 100).roundToInt()}%",
                value = state.opacity, range = 0.05f..1f
            ) { vm.setOpacity(it) }
            LabeledSlider(
                label = stringResource(R.string.twf_rotation),
                valueText = "${state.rotation.roundToInt()}°",
                value = state.rotation, range = 0f..90f
            ) { vm.setRotation(it) }
            FloatField(stringResource(R.string.twf_font_size), state.fontSize) { vm.setFontSize(it) }
        }
        PdfToolId.CREATE -> {
            OutlinedTextField(
                value = state.createText,
                onValueChange = vm::setCreateText,
                label = { Text(stringResource(R.string.twf_create_hint)) },
                modifier = Modifier.fillMaxWidth().height(220.dp)
            )
        }
        else -> Unit
    }
}

@Composable
private fun QualitySlider(value: Float, onChange: (Float) -> Unit) {
    Column {
        Text("${stringResource(R.string.twf_quality)}: ${(value * 100).roundToInt()}%")
        Slider(value = value, onValueChange = onChange, valueRange = 0.3f..1f)
    }
}

@Composable
private fun LabeledSlider(
    label: String,
    valueText: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    onChange: (Float) -> Unit
) {
    Column {
        Text("$label: $valueText")
        Slider(value = value, onValueChange = onChange, valueRange = range)
    }
}

@Composable
private fun IntField(label: String, value: Int, onChange: (Int) -> Unit) {
    OutlinedTextField(
        value = value.toString(),
        onValueChange = { it.toIntOrNull()?.let(onChange) },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun FloatField(label: String, value: Float, onChange: (Float) -> Unit) {
    OutlinedTextField(
        value = value.roundToInt().toString(),
        onValueChange = { it.toFloatOrNull()?.let(onChange) },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun PlacementDropdown(current: PageNumberPlacement, onSelect: (PageNumberPlacement) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val labels = mapOf(
        PageNumberPlacement.BOTTOM_CENTER to R.string.twf_pos_bottom_center,
        PageNumberPlacement.BOTTOM_RIGHT to R.string.twf_pos_bottom_right,
        PageNumberPlacement.TOP_CENTER to R.string.twf_pos_top_center,
        PageNumberPlacement.TOP_RIGHT to R.string.twf_pos_top_right
    )
    Column {
        Text(stringResource(R.string.twf_position), style = MaterialTheme.typography.labelMedium)
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(labels.getValue(current)))
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            labels.forEach { (placement, res) ->
                DropdownMenuItem(
                    text = { Text(stringResource(res)) },
                    onClick = { onSelect(placement); expanded = false }
                )
            }
        }
    }
}

@Composable
private fun ResultTextSection(text: String, onSaveTxt: () -> Unit, context: Context) {
    val clipboard = LocalClipboardManager.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = text,
            onValueChange = {},
            readOnly = true,
            modifier = Modifier.fillMaxWidth().height(240.dp)
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onSaveTxt) { Text(stringResource(R.string.twf_save_txt)) }
            OutlinedButton(onClick = { clipboard.setText(AnnotatedString(text)) }) {
                Icon(Icons.Filled.ContentCopy, contentDescription = null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.twf_copy), modifier = Modifier.padding(start = 6.dp))
            }
            OutlinedButton(onClick = {
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                context.startActivity(Intent.createChooser(send, null))
            }) {
                Icon(Icons.Filled.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.twf_share), modifier = Modifier.padding(start = 6.dp))
            }
        }
    }
}

@Composable
private fun Hint(text: String) {
    Text(text = text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

private fun persist(context: Context, uri: Uri) {
    runCatching {
        context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
}

private fun queryName(context: Context, uri: Uri): String {
    var name = uri.lastPathSegment ?: "file"
    runCatching {
        context.contentResolver.query(uri, null, null, null, null)?.use { c ->
            val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (c.moveToFirst() && idx >= 0) c.getString(idx)?.let { name = it }
        }
    }
    return name
}
