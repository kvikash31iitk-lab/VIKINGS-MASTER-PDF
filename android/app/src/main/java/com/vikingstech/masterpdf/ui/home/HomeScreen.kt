package com.vikingstech.masterpdf.ui.home

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DocumentScanner
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.domain.model.SortMode
import com.vikingstech.masterpdf.ui.theme.VikingBlue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onOpenDocument: (String) -> Unit,
    onContinueReading: (uri: String, page: Int) -> Unit,
    onScan: () -> Unit,
    onTools: () -> Unit,
    onSettings: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val recents by viewModel.displayed.collectAsStateWithLifecycle()
    val query by viewModel.searchQuery.collectAsStateWithLifecycle()
    val sortMode by viewModel.sortMode.collectAsStateWithLifecycle()
    val hero by viewModel.hero.collectAsStateWithLifecycle()
    val hasAnyRecents by viewModel.hasAnyRecents.collectAsStateWithLifecycle()

    val openLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            onOpenDocument(uri.toString())
        }
    }
    val openPdf = { openLauncher.launch(arrayOf("application/pdf")) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.app_name)) },
                actions = {
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Filled.Settings, contentDescription = stringResource(R.string.action_settings))
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            QuickActions(onOpen = { openPdf() }, onScan = onScan, onTools = onTools)

            OutlinedTextField(
                value = query,
                onValueChange = viewModel::setSearch,
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                placeholder = { Text(stringResource(R.string.home_search_hint)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp)
            )

            SortChipsRow(selected = sortMode, onSelect = viewModel::setSort)

            hero?.let { doc ->
                ContinueReadingCard(
                    doc = doc,
                    onContinue = { onContinueReading(doc.uri, doc.lastPageIndex) }
                )
            }

            when {
                !hasAnyRecents -> EmptyHome(
                    onOpen = { openPdf() },
                    onScan = onScan,
                    modifier = Modifier.weight(1f)
                )

                recents.isEmpty() -> Box(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = stringResource(R.string.home_no_results),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                else -> {
                    Text(
                        text = stringResource(R.string.home_recents),
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(recents, key = { it.uri }) { recent ->
                            RecentRow(
                                recent = recent,
                                onClick = { onOpenDocument(recent.uri) },
                                onTogglePin = { viewModel.setPinned(recent.uri, !recent.isPinned) },
                                onRemove = { viewModel.remove(recent.uri) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickActions(onOpen: () -> Unit, onScan: () -> Unit, onTools: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        QuickAction(Icons.Filled.FolderOpen, stringResource(R.string.action_open), Modifier.weight(1f), onOpen)
        QuickAction(Icons.Filled.DocumentScanner, stringResource(R.string.action_scan), Modifier.weight(1f), onScan)
        QuickAction(Icons.Filled.Build, stringResource(R.string.action_tools), Modifier.weight(1f), onTools)
    }
}

@Composable
private fun QuickAction(
    icon: ImageVector,
    label: String,
    modifier: Modifier,
    onClick: () -> Unit
) {
    OutlinedButton(onClick = onClick, modifier = modifier) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, contentDescription = null)
            Text(label, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SortChipsRow(selected: SortMode, onSelect: (SortMode) -> Unit) {
    val entries = listOf(
        SortMode.RECENT to R.string.home_sort_recent,
        SortMode.PINNED to R.string.home_sort_pinned,
        SortMode.LARGEST to R.string.home_sort_largest,
        SortMode.SMALLEST to R.string.home_sort_smallest,
        SortMode.AZ to R.string.home_sort_az
    )
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(entries) { (mode, labelRes) ->
            FilterChip(
                selected = selected == mode,
                onClick = { onSelect(mode) },
                label = { Text(stringResource(labelRes)) }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ContinueReadingCard(doc: RecentDocument, onContinue: () -> Unit) {
    Card(
        onClick = onContinue,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            RecentThumbnail(doc.thumbnailUri, Modifier.size(width = 56.dp, height = 72.dp))
            Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(
                    text = stringResource(R.string.home_continue_reading),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(doc.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleMedium)
                Text(
                    text = stringResource(R.string.home_page_progress, doc.lastPageIndex + 1, doc.pageCount),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Button(onClick = onContinue) { Text(stringResource(R.string.home_continue)) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RecentRow(
    recent: RecentDocument,
    onClick: () -> Unit,
    onTogglePin: () -> Unit,
    onRemove: () -> Unit
) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            RecentThumbnail(recent.thumbnailUri, Modifier.size(width = 56.dp, height = 72.dp))
            Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(recent.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleSmall)
                Text(
                    text = "${recent.pageCount} pages · ${formatSize(recent.sizeBytes)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = onTogglePin) {
                Icon(
                    imageVector = if (recent.isPinned) Icons.Filled.PushPin else Icons.Outlined.PushPin,
                    contentDescription = stringResource(if (recent.isPinned) R.string.cd_unpin else R.string.cd_pin)
                )
            }
            IconButton(onClick = onRemove) {
                Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.cd_remove))
            }
        }
    }
}

@Composable
private fun RecentThumbnail(path: String?, modifier: Modifier = Modifier) {
    val bitmap by produceState<Bitmap?>(initialValue = null, key1 = path) {
        value = if (path == null) null else withContext(Dispatchers.IO) {
            runCatching { BitmapFactory.decodeFile(path) }.getOrNull()
        }
    }
    Box(
        modifier = modifier
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(4.dp)),
        contentAlignment = Alignment.Center
    ) {
        val bmp = bitmap
        if (bmp != null) {
            Image(
                bitmap = bmp.asImageBitmap(),
                contentDescription = stringResource(R.string.cd_thumbnail),
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(4.dp))
            )
        } else {
            Icon(Icons.Filled.PictureAsPdf, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun EmptyHome(onOpen: () -> Unit, onScan: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        VikingShieldIllustration(modifier = Modifier.size(140.dp))
        Spacer(Modifier.height(16.dp))
        Text(
            text = stringResource(R.string.home_empty),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = onOpen) {
                Icon(Icons.Filled.FolderOpen, contentDescription = null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.action_open), modifier = Modifier.padding(start = 6.dp))
            }
            OutlinedButton(onClick = onScan) {
                Icon(Icons.Filled.DocumentScanner, contentDescription = null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.action_scan), modifier = Modifier.padding(start = 6.dp))
            }
        }
    }
}

/** A programmatically-drawn Viking shield enclosing a stylised PDF page. */
@Composable
private fun VikingShieldIllustration(modifier: Modifier = Modifier) {
    val shieldColor = VikingBlue
    val paper = Color.White
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val shield = Path().apply {
            moveTo(w * 0.5f, 0f)
            lineTo(w, h * 0.18f)
            lineTo(w, h * 0.55f)
            cubicTo(w, h * 0.82f, w * 0.74f, h * 0.96f, w * 0.5f, h)
            cubicTo(w * 0.26f, h * 0.96f, 0f, h * 0.82f, 0f, h * 0.55f)
            lineTo(0f, h * 0.18f)
            close()
        }
        drawPath(shield, color = shieldColor)

        // Document page inside the shield.
        val docW = w * 0.34f
        val docH = h * 0.40f
        val docLeft = (w - docW) / 2f
        val docTop = h * 0.26f
        drawRoundRect(
            color = paper,
            topLeft = Offset(docLeft, docTop),
            size = Size(docW, docH),
            cornerRadius = CornerRadius(6f, 6f)
        )
        // Text lines on the page.
        val lineColor = shieldColor.copy(alpha = 0.5f)
        repeat(3) { i ->
            val ly = docTop + docH * (0.30f + i * 0.22f)
            drawRoundRect(
                color = lineColor,
                topLeft = Offset(docLeft + docW * 0.16f, ly),
                size = Size(docW * 0.68f, h * 0.018f),
                cornerRadius = CornerRadius(3f, 3f)
            )
        }
    }
}

private fun formatSize(bytes: Long): String = when {
    bytes <= 0 -> "—"
    bytes < 1024 -> "$bytes B"
    bytes < 1024 * 1024 -> "${bytes / 1024} KB"
    else -> "%.1f MB".format(bytes / (1024.0 * 1024.0))
}
