package com.vikingstech.masterpdf.ui.viewer

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkAdd
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.domain.model.Bookmark
import com.vikingstech.masterpdf.ui.components.EmptyState
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookmarkPanel(
    bookmarks: List<Bookmark>,
    currentPage: Int,
    render: suspend (pageIndex: Int, targetWidthPx: Int) -> Bitmap?,
    onJumpToPage: (Int) -> Unit,
    onDeleteBookmark: (Long) -> Unit,
    onAddBookmark: (label: String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showAddDialog by remember { mutableStateOf(false) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Text(
            text = stringResource(R.string.bookmarks_title),
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 8.dp)
        )

        if (bookmarks.isEmpty()) {
            EmptyState(
                icon = Icons.Filled.Bookmark,
                title = stringResource(R.string.bookmarks_empty),
                modifier = Modifier.heightIn(min = 160.dp)
            )
        } else {
            LazyColumn(modifier = Modifier.heightIn(max = 420.dp)) {
                items(bookmarks, key = { it.id }) { bookmark ->
                    BookmarkRow(
                        bookmark = bookmark,
                        render = render,
                        onClick = { onJumpToPage(bookmark.pageIndex) },
                        onDelete = { onDeleteBookmark(bookmark.id) }
                    )
                }
            }
        }

        ExtendedFloatingActionButton(
            onClick = { showAddDialog = true },
            icon = { Icon(Icons.Filled.BookmarkAdd, contentDescription = null) },
            text = { Text(stringResource(R.string.bookmarks_add)) },
            modifier = Modifier
                .padding(16.dp)
                .align(Alignment.CenterHorizontally)
        )
    }

    if (showAddDialog) {
        AddBookmarkDialog(
            defaultLabel = stringResource(R.string.bookmark_page, currentPage + 1),
            onConfirm = { label ->
                onAddBookmark(label)
                showAddDialog = false
            },
            onDismiss = { showAddDialog = false }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BookmarkRow(
    bookmark: Bookmark,
    render: suspend (pageIndex: Int, targetWidthPx: Int) -> Bitmap?,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value != SwipeToDismissBoxValue.Settled) {
                onDelete()
                true
            } else {
                false
            }
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.errorContainer)
                    .padding(horizontal = 24.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = stringResource(R.string.bookmarks_delete),
                    tint = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }
    ) {
        ListItem(
            leadingContent = { BookmarkThumbnail(bookmark.pageIndex, render) },
            headlineContent = {
                Text(bookmark.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
            },
            supportingContent = {
                Text(
                    text = stringResource(R.string.bookmark_page, bookmark.pageIndex + 1) +
                        " · " + formatDate(bookmark.createdAt)
                )
            },
            modifier = Modifier.clickable(onClick = onClick)
        )
    }
}

@Composable
private fun BookmarkThumbnail(
    pageIndex: Int,
    render: suspend (pageIndex: Int, targetWidthPx: Int) -> Bitmap?
) {
    val density = LocalDensity.current
    val widthPx = with(density) { 32.dp.roundToPx() }
    var bitmap by remember(pageIndex) { mutableStateOf<Bitmap?>(null) }

    LaunchedEffect(pageIndex) { bitmap = render(pageIndex, widthPx) }

    val current = bitmap
    Box(
        modifier = Modifier
            .size(width = 32.dp, height = 40.dp)
            .background(Color.White, RoundedCornerShape(2.dp)),
        contentAlignment = Alignment.Center
    ) {
        if (current != null) {
            Image(
                bitmap = current.asImageBitmap(),
                contentDescription = null,
                contentScale = ContentScale.Fit
            )
        } else {
            Icon(Icons.Filled.Bookmark, contentDescription = null)
        }
    }
}

@Composable
private fun AddBookmarkDialog(
    defaultLabel: String,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var label by remember { mutableStateOf(defaultLabel) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.bookmarks_add)) },
        text = {
            OutlinedTextField(
                value = label,
                onValueChange = { label = it },
                label = { Text(stringResource(R.string.bookmarks_label_hint)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { contentDescription = "Bookmark label" }
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(label.trim()) }) {
                Text(stringResource(R.string.generic_add))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.generic_cancel)) }
        }
    )
}

private val dateFormat = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())

private fun formatDate(millis: Long): String = dateFormat.format(Date(millis))
