package com.vikingstech.masterpdf.ui.home

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DocumentScanner
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.ui.components.EmptyState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onOpenDocument: (String) -> Unit,
    onScan: () -> Unit,
    onTools: () -> Unit,
    onSettings: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val recents by viewModel.recents.collectAsStateWithLifecycle()

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

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringRes(R.string.app_name)) },
                actions = {
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Filled.Settings, contentDescription = stringRes(R.string.action_settings))
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            QuickActions(
                onOpen = { openLauncher.launch(arrayOf("application/pdf")) },
                onScan = onScan,
                onTools = onTools
            )
            if (recents.isEmpty()) {
                EmptyState(
                    icon = Icons.Filled.PictureAsPdf,
                    title = stringRes(R.string.home_empty),
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Text(
                    text = stringRes(R.string.home_recents),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
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

@Composable
private fun QuickActions(onOpen: () -> Unit, onScan: () -> Unit, onTools: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        QuickAction(Icons.Filled.FolderOpen, stringRes(R.string.action_open), Modifier.weight(1f), onOpen)
        QuickAction(Icons.Filled.DocumentScanner, stringRes(R.string.action_scan), Modifier.weight(1f), onScan)
        QuickAction(Icons.Filled.Build, stringRes(R.string.action_tools), Modifier.weight(1f), onTools)
    }
}

@Composable
private fun QuickAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    modifier: Modifier,
    onClick: () -> Unit
) {
    OutlinedButton(onClick = onClick, modifier = modifier) {
        Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
            Icon(icon, contentDescription = null)
            Text(label, style = MaterialTheme.typography.labelSmall)
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
        ListItem(
            headlineContent = {
                Text(recent.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
            },
            supportingContent = {
                Text("${recent.pageCount} pages · ${formatSize(recent.sizeBytes)}")
            },
            leadingContent = {
                Icon(Icons.Filled.PictureAsPdf, contentDescription = null)
            },
            trailingContent = {
                Row {
                    IconButton(onClick = onTogglePin) {
                        Icon(
                            imageVector = if (recent.isPinned) Icons.Filled.PushPin else Icons.Outlined.PushPin,
                            contentDescription = "Pin"
                        )
                    }
                    IconButton(onClick = onRemove) {
                        Icon(Icons.Filled.Close, contentDescription = "Remove")
                    }
                }
            }
        )
    }
}

private fun formatSize(bytes: Long): String = when {
    bytes <= 0 -> "—"
    bytes < 1024 -> "$bytes B"
    bytes < 1024 * 1024 -> "${bytes / 1024} KB"
    else -> "%.1f MB".format(bytes / (1024.0 * 1024.0))
}

@Composable
private fun stringRes(id: Int): String = androidx.compose.ui.res.stringResource(id)
