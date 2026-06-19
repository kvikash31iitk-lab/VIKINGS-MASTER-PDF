package com.vikingstech.masterpdf.ui.home

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.DocumentScanner
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.ui.draw.drawBehind
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.domain.model.AppSettings
import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.domain.model.SortMode
import com.vikingstech.masterpdf.domain.model.ThemeMode
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
    settings: AppSettings,
    onToggleTheme: () -> Unit,
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
        bottomBar = {
            CustomBottomBar(
                settings = settings,
                onOpenPdf = openPdf,
                onTools = onTools,
                onToggleTheme = onToggleTheme
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(padding)
        ) {
            // Branded Top Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(RoundedCornerShape(11.dp))
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(Color(0xFF3B82F6), Color(0xFF1E40AF))
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.PictureAsPdf,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Spacer(Modifier.width(11.dp))
                    Column {
                        Text(
                            text = "Vikings Master",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 18.sp,
                            color = MaterialTheme.colorScheme.onBackground,
                            letterSpacing = (-0.3).sp,
                            lineHeight = 1.sp
                        )
                        Spacer(Modifier.height(3.dp))
                        Text(
                            text = "PDF Reader & Editor",
                            fontSize = 11.5.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 0.2.sp
                        )
                    }
                }
                
                IconButton(
                    onClick = onToggleTheme,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(13.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .border(
                            width = 1.dp,
                            color = MaterialTheme.colorScheme.outline,
                            shape = RoundedCornerShape(13.dp)
                        )
                ) {
                    Icon(
                        imageVector = if (settings.themeMode == ThemeMode.DARK) Icons.Filled.LightMode else Icons.Filled.DarkMode,
                        contentDescription = "Toggle theme",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            // Pill-shaped Search Bar
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp)
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = viewModel::setSearch,
                    leadingIcon = { 
                        Icon(
                            imageVector = Icons.Filled.Search, 
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        ) 
                    },
                    placeholder = { 
                        Text(
                            text = stringResource(R.string.home_search_hint),
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.SemiBold
                        ) 
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(15.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                        focusedIndicatorColor = MaterialTheme.colorScheme.outline,
                        unfocusedIndicatorColor = MaterialTheme.colorScheme.outline,
                        cursorColor = MaterialTheme.colorScheme.primary,
                        focusedTextColor = MaterialTheme.colorScheme.onSurface,
                        unfocusedTextColor = MaterialTheme.colorScheme.onSurface
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                )
            }

            SortChipsRow(selected = sortMode, onSelect = viewModel::setSort)

            // Dynamic view loading depending on recents
            when {
                !hasAnyRecents -> EmptyHome(
                    onOpen = { openPdf() },
                    onScan = onScan,
                    modifier = Modifier.weight(1f)
                )

                recents.isEmpty() -> Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(32.dp)
                    ) {
                        VikingShieldIllustration(modifier = Modifier.size(110.dp))
                        Spacer(Modifier.height(16.dp))
                        Text(
                            text = stringResource(R.string.home_no_results),
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                else -> {
                    // Full scrollable content in a grid
                    Column(modifier = Modifier.weight(1f)) {
                        hero?.let { doc ->
                            Text(
                                text = stringResource(R.string.home_continue_reading).uppercase(),
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                ),
                                modifier = Modifier.padding(start = 16.dp, top = 8.dp, bottom = 4.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                            )
                            ContinueReadingCard(
                                doc = doc,
                                onContinue = { onContinueReading(doc.uri, doc.lastPageIndex) }
                            )
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "ALL DOCUMENTS",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                ),
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                            )
                            Text(
                                text = "${recents.size} files",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }

                        // 2-Column Document Grid (Mockup Style)
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(2),
                            state = rememberLazyGridState(),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(recents, key = { it.uri }) { recent ->
                                DocumentGridCard(
                                    recent = recent,
                                    onClick = { onOpenDocument(recent.uri) },
                                    onTogglePin = { viewModel.setPinned(recent.uri, !recent.isPinned) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DocumentGridCard(
    recent: RecentDocument,
    onClick: () -> Unit,
    onTogglePin: () -> Unit
) {
    val bitmap by produceState<Bitmap?>(initialValue = null, key1 = recent.thumbnailUri) {
        value = if (recent.thumbnailUri == null) null else withContext(Dispatchers.IO) {
            runCatching { BitmapFactory.decodeFile(recent.thumbnailUri) }.getOrNull()
        }
    }

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column {
            val cardAccent = remember(recent.name) {
                when {
                    recent.name.contains("Financial", ignoreCase = true) -> Color(0xFF2563EB)
                    recent.name.contains("Project", ignoreCase = true) -> Color(0xFF0EA5E9)
                    recent.name.contains("Forecast", ignoreCase = true) -> Color(0xFF6366F1)
                    recent.name.contains("Invoice", ignoreCase = true) -> Color(0xFF10B981)
                    recent.name.contains("Vendor", ignoreCase = true) -> Color(0xFFF59E0B)
                    recent.name.contains("Series", ignoreCase = true) -> Color(0xFFEC4899)
                    else -> {
                        val idx = recent.name.hashCode().coerceAtLeast(0) % 6
                        listOf(
                            Color(0xFF2563EB),
                            Color(0xFF0EA5E9),
                            Color(0xFF6366F1),
                            Color(0xFF10B981),
                            Color(0xFFF59E0B),
                            Color(0xFFEC4899)
                        )[idx]
                    }
                }
            }

            val lightAccent = remember(cardAccent) { cardAccent.copy(alpha = 0.2f) }
            val mediumAccent = remember(cardAccent) { cardAccent.copy(alpha = 0.4f) }

            // Thumbnail Page Area (Top ~70%)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(124.dp)
                    .background(Color.White)
                    .padding(top = 12.dp, start = 11.dp, end = 11.dp),
                contentAlignment = Alignment.TopStart
            ) {
                val bmp = bitmap
                if (bmp != null) {
                    Image(
                        bitmap = bmp.asImageBitmap(),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Box(modifier = Modifier.fillMaxSize()) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.Top,
                            horizontalAlignment = Alignment.Start
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.58f)
                                    .height(7.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(cardAccent)
                            )
                            Spacer(Modifier.height(9.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.88f)
                                    .height(4.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(Color(0xFFDBE2EF))
                            )
                            Spacer(Modifier.height(6.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.74f)
                                    .height(4.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(Color(0xFFE3E9F3))
                            )
                            Spacer(Modifier.height(6.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.82f)
                                    .height(4.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(Color(0xFFE3E9F3))
                            )
                            Spacer(Modifier.height(6.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.50f)
                                    .height(4.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(Color(0xFFE3E9F3))
                            )
                        }

                        Row(
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .fillMaxWidth()
                                .height(30.dp)
                                .padding(bottom = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.Bottom
                        ) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight(0.45f)
                                    .clip(RoundedCornerShape(topStart = 1.dp, topEnd = 1.dp))
                                    .background(lightAccent)
                            )
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight(0.80f)
                                    .clip(RoundedCornerShape(topStart = 1.dp, topEnd = 1.dp))
                                    .background(mediumAccent)
                            )
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight(0.60f)
                                    .clip(RoundedCornerShape(topStart = 1.dp, topEnd = 1.dp))
                                    .background(lightAccent)
                            )
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight(1.00f)
                                    .clip(RoundedCornerShape(topStart = 1.dp, topEnd = 1.dp))
                                    .background(cardAccent)
                            )
                        }
                    }
                }

                if (recent.isPinned) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(top = 9.dp)
                            .size(24.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF2563EB))
                            .shadow(elevation = 3.dp, shape = RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.PushPin,
                            contentDescription = "Pinned badge",
                            tint = Color.White,
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }
            }

            // Footer Section
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 11.dp)
                    .padding(top = 11.dp, bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = recent.name,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.5.sp,
                            modifier = Modifier.weight(1f)
                        )
                        Spacer(Modifier.width(6.dp))
                        Icon(
                            imageVector = if (recent.isPinned) Icons.Filled.PushPin else Icons.Outlined.PushPin,
                            contentDescription = "Toggle Pin",
                            tint = if (recent.isPinned) Color(0xFF2563EB) else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                            modifier = Modifier
                                .size(15.dp)
                                .clickable(onClick = onTogglePin)
                        )
                    }
                    Spacer(Modifier.height(5.dp))
                    Text(
                        text = "${recent.pageCount} pages · ${formatSize(recent.sizeBytes)}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
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
        SortMode.AZ to R.string.home_sort_az
    )
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(entries) { (mode, labelRes) ->
            FilterChip(
                selected = selected == mode,
                onClick = { onSelect(mode) },
                label = { Text(stringResource(labelRes)) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.primary,
                    containerColor = MaterialTheme.colorScheme.surface,
                    labelColor = MaterialTheme.colorScheme.onSurfaceVariant
                ),
                border = FilterChipDefaults.filterChipBorder(
                    enabled = true,
                    selected = selected == mode,
                    selectedBorderColor = MaterialTheme.colorScheme.primary,
                    borderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f),
                    borderWidth = 1.dp,
                    selectedBorderWidth = 1.dp
                ),
                shape = RoundedCornerShape(12.dp)
            )
        }
    }
}

@Composable
private fun ContinueReadingCard(doc: RecentDocument, onContinue: () -> Unit) {
    val progress = if (doc.pageCount > 0) {
        (doc.lastPageIndex + 1).toFloat() / doc.pageCount.toFloat()
    } else {
        0f
    }

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .shadow(
                elevation = 16.dp, 
                shape = RoundedCornerShape(20.dp), 
                spotColor = Color(0x662563EB), 
                ambientColor = Color(0x662563EB)
            )
            .clickable(onClick = onContinue)
    ) {
        Box(
            modifier = Modifier
                .background(
                    Brush.linearGradient(
                        colors = listOf(Color(0xFF1E3A8A), Color(0xFF2563EB), Color(0xFF1D4ED8))
                    )
                )
                .padding(18.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Page thumbnail mockup with mini charts (86dp x 112dp)
                Box(
                    modifier = Modifier
                        .size(width = 86.dp, height = 112.dp)
                        .shadow(elevation = 8.dp, shape = RoundedCornerShape(11.dp))
                        .background(Color.White, RoundedCornerShape(11.dp))
                        .padding(9.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Top,
                        horizontalAlignment = Alignment.Start
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(0.62f)
                                .height(8.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(Color(0xFF1E40AF))
                        )
                        Spacer(Modifier.height(8.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(0.90f)
                                .height(5.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(Color(0xFFCDD8EE))
                        )
                        Spacer(Modifier.height(5.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(0.80f)
                                .height(5.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(Color(0xFFDDE4F2))
                        )
                        Spacer(Modifier.height(9.dp))
                        
                        // Mini bar chart in preview
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(34.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.Bottom
                        ) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight(0.40f)
                                    .clip(RoundedCornerShape(topStart = 1.dp, topEnd = 1.dp))
                                    .background(Color(0xFF93B4F5))
                            )
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight(0.70f)
                                    .clip(RoundedCornerShape(topStart = 1.dp, topEnd = 1.dp))
                                    .background(Color(0xFF5B8DEF))
                            )
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight(0.55f)
                                    .clip(RoundedCornerShape(topStart = 1.dp, topEnd = 1.dp))
                                    .background(Color(0xFF93B4F5))
                            )
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight(1.00f)
                                    .clip(RoundedCornerShape(topStart = 1.dp, topEnd = 1.dp))
                                    .background(Color(0xFF2563EB))
                            )
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 16.dp)
                ) {
                    Text(
                        text = "RESUME",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(Modifier.height(5.dp))
                    Text(
                        text = doc.name,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.3).sp,
                        lineHeight = 20.sp
                    )
                    Spacer(Modifier.height(3.dp))
                    Text(
                        text = "Page ${doc.lastPageIndex + 1} of ${doc.pageCount}",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold
                    )

                    Spacer(Modifier.height(12.dp))

                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(RoundedCornerShape(3.dp)),
                        color = Color.White,
                        trackColor = Color.White.copy(alpha = 0.25f)
                    )

                    Spacer(Modifier.height(11.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val percent = (progress * 100).toInt()
                        Text(
                            text = "$percent% complete",
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Bold
                        )

                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(11.dp))
                                .background(Color.White)
                                .clickable(onClick = onContinue)
                                .padding(horizontal = 16.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "Continue",
                                color = Color(0xFF1D4ED8),
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                            Icon(
                                imageVector = Icons.Filled.KeyboardArrowRight,
                                contentDescription = null,
                                tint = Color(0xFF1D4ED8),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyHome(onOpen: () -> Unit, onScan: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        VikingShieldIllustration(modifier = Modifier.size(150.dp))
        Spacer(Modifier.height(24.dp))
        Text(
            text = stringResource(R.string.home_empty),
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(Modifier.height(24.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .shadow(2.dp, RoundedCornerShape(12.dp))
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.primary)
                    .clickable(onClick = onOpen)
                    .padding(horizontal = 18.dp, vertical = 12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.FolderOpen, 
                        contentDescription = null, 
                        modifier = Modifier.size(18.dp),
                        tint = Color.White
                    )
                    Text(
                        text = stringResource(R.string.action_open), 
                        modifier = Modifier.padding(start = 8.dp),
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
            Box(
                modifier = Modifier
                    .shadow(2.dp, RoundedCornerShape(12.dp))
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .clickable(onClick = onScan)
                    .padding(horizontal = 18.dp, vertical = 12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.DocumentScanner, 
                        contentDescription = null, 
                        modifier = Modifier.size(18.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = stringResource(R.string.action_scan), 
                        modifier = Modifier.padding(start = 8.dp),
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

/** A programmatically-drawn Viking shield enclosing a stylised PDF page. */
@Composable
private fun VikingShieldIllustration(modifier: Modifier = Modifier) {
    val primaryColor = MaterialTheme.colorScheme.primary
    val primaryLight = MaterialTheme.colorScheme.primaryContainer
    val paperColor = MaterialTheme.colorScheme.surface
    
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
        
        // Draw primary shield background gradient
        val shieldGradient = Brush.verticalGradient(
            colors = listOf(primaryColor, primaryColor.copy(alpha = 0.7f)),
            startY = 0f,
            endY = h
        )
        drawPath(shield, brush = shieldGradient)
        
        // Draw steel rim outline
        drawPath(
            path = shield,
            color = primaryLight,
            style = Stroke(
                width = 5.dp.toPx(),
                cap = StrokeCap.Round
            )
        )

        // Document page inside the shield.
        val docW = w * 0.34f
        val docH = h * 0.40f
        val docLeft = (w - docW) / 2f
        val docTop = h * 0.26f
        
        // Draw shadowed paper background
        drawRoundRect(
            color = paperColor,
            topLeft = Offset(docLeft, docTop),
            size = Size(docW, docH),
            cornerRadius = CornerRadius(8f, 8f)
        )
        
        // Draw steel boss center (mini circle representing a shield boss overlapping the document)
        drawCircle(
            color = primaryLight,
            radius = 6.dp.toPx(),
            center = Offset(w * 0.5f, h * 0.12f)
        )
        
        // Text lines on the page.
        val lineColor = primaryColor.copy(alpha = 0.4f)
        repeat(3) { i ->
            val ly = docTop + docH * (0.26f + i * 0.22f)
            drawRoundRect(
                color = lineColor,
                topLeft = Offset(docLeft + docW * 0.16f, ly),
                size = Size(docW * 0.68f, h * 0.016f),
                cornerRadius = CornerRadius(4f, 4f)
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

@Composable
private fun CustomBottomBar(
    settings: AppSettings,
    onOpenPdf: () -> Unit,
    onTools: () -> Unit,
    onToggleTheme: () -> Unit
) {
    val isLight = settings.themeMode == ThemeMode.LIGHT
    val containerColor = if (isLight) Color(0xD1FFFFFF) else Color(0xBC0D1830)
    val borderColor = if (isLight) Color(0x1A0B1B3A) else Color(0x17FFFFFF)
    val activeColor = Color(0xFF2563EB)
    val inactiveColor = if (isLight) Color(0xFF90A0BE) else Color(0xFF8497BE)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(containerColor)
            .drawBehind {
                drawLine(
                    color = borderColor,
                    start = Offset(0f, 0f),
                    end = Offset(size.width, 0f),
                    strokeWidth = 1.dp.toPx()
                )
            }
            .navigationBarsPadding()
            .padding(top = 8.dp, bottom = 12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            BottomNavItem(
                icon = Icons.Outlined.FolderOpen,
                label = "Files",
                isSelected = true,
                activeColor = activeColor,
                inactiveColor = inactiveColor,
                onClick = {}
            )
            BottomNavItem(
                icon = Icons.Outlined.Description,
                label = "Reader",
                isSelected = false,
                activeColor = activeColor,
                inactiveColor = inactiveColor,
                onClick = onOpenPdf
            )
            BottomNavItem(
                icon = Icons.Outlined.GridView,
                label = "Tools",
                isSelected = false,
                activeColor = activeColor,
                inactiveColor = inactiveColor,
                onClick = onTools
            )
            BottomNavItem(
                icon = if (settings.themeMode == ThemeMode.DARK) Icons.Outlined.LightMode else Icons.Outlined.DarkMode,
                label = "Theme",
                isSelected = false,
                activeColor = activeColor,
                inactiveColor = inactiveColor,
                onClick = onToggleTheme
            )
        }
    }
}

@Composable
private fun BottomNavItem(
    icon: ImageVector,
    label: String,
    isSelected: Boolean,
    activeColor: Color,
    inactiveColor: Color,
    onClick: () -> Unit
) {
    val color = if (isSelected) activeColor else inactiveColor
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = color,
            modifier = Modifier.size(23.dp)
        )
        Text(
            text = label,
            color = color,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

