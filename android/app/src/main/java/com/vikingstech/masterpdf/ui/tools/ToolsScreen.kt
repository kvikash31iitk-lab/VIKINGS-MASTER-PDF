package com.vikingstech.masterpdf.ui.tools

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.MergeType
import androidx.compose.material.icons.filled.Compress
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Numbers
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.vikingstech.masterpdf.R
import kotlinx.coroutines.launch

private data class ToolEntry(val title: String, val subtitle: String, val icon: ImageVector)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ToolsScreen(onBack: () -> Unit) {
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    val tools = remember {
        listOf(
            ToolEntry("Merge PDFs", "Combine multiple documents into one", Icons.AutoMirrored.Filled.MergeType),
            ToolEntry("Split PDF", "Break a document into separate files", Icons.Filled.Layers),
            ToolEntry("Compress", "Reduce file size for sharing", Icons.Filled.Compress),
            ToolEntry("Watermark", "Stamp text or an image over pages", Icons.Filled.WaterDrop),
            ToolEntry("Bates Numbering", "Add legal sequential numbering", Icons.Filled.Numbers)
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.action_tools)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back)
                        )
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbar) }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(vertical = 8.dp)
        ) {
            items(tools) { tool ->
                ListItem(
                    headlineContent = { Text(tool.title) },
                    supportingContent = { Text(tool.subtitle) },
                    leadingContent = { Icon(tool.icon, contentDescription = null) },
                    modifier = Modifier.clickable {
                        scope.launch { snackbar.showSnackbar("${tool.title} — coming soon") }
                    }
                )
                HorizontalDivider()
            }
        }
    }
}
