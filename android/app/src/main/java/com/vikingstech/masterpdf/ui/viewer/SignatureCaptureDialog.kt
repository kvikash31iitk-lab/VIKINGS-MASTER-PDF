package com.vikingstech.masterpdf.ui.viewer

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotStateListOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.domain.model.Signature

/**
 * Full-screen capture surface for a hand-drawn signature. Strokes are collected
 * as polylines and rasterised into a transparent [Bitmap] on "Done", so the
 * resulting image stamps cleanly over any page background.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignatureCaptureDialog(
    savedSignatures: List<Signature>,
    onSave: (Bitmap) -> Unit,
    onSelectExisting: (Signature) -> Unit,
    onDismiss: () -> Unit
) {
    val strokes = remember { snapshotStateListOf<List<Offset>>() }
    var currentPath by remember { mutableStateOf<List<Offset>>(emptyList()) }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(stringResource(R.string.signature_title)) },
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.generic_cancel))
                        }
                    },
                    actions = {
                        IconButton(onClick = { strokes.clear(); currentPath = emptyList() }) {
                            Icon(Icons.Filled.DeleteOutline, contentDescription = stringResource(R.string.signature_clear))
                        }
                        IconButton(
                            enabled = strokes.isNotEmpty() || currentPath.isNotEmpty(),
                            onClick = {
                                val finished = if (currentPath.isNotEmpty()) strokes + listOf(currentPath) else strokes.toList()
                                val bmp = rasterise(finished, canvasSize)
                                if (bmp != null) onSave(bmp)
                            }
                        ) {
                            Icon(Icons.Filled.Check, contentDescription = stringResource(R.string.signature_done))
                        }
                    }
                )
            }
        ) { padding ->
            Column(modifier = Modifier.fillMaxSize().padding(padding)) {
                Canvas(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .background(Color.White)
                        .onSizeChanged { canvasSize = it }
                        .semantics { contentDescription = "Signature drawing area" }
                        .pointerInput(Unit) {
                            detectDragGestures(
                                onDragStart = { offset -> currentPath = listOf(offset) },
                                onDrag = { change, _ -> currentPath = currentPath + change.position },
                                onDragEnd = {
                                    if (currentPath.isNotEmpty()) {
                                        strokes.add(currentPath)
                                        currentPath = emptyList()
                                    }
                                }
                            )
                        }
                ) {
                    (strokes + listOf(currentPath)).forEach { path ->
                        for (i in 0 until path.size - 1) {
                            drawLine(
                                color = Color.Black,
                                start = path[i],
                                end = path[i + 1],
                                strokeWidth = 5f,
                                cap = StrokeCap.Round
                            )
                        }
                    }
                }

                if (savedSignatures.isNotEmpty()) {
                    Text(
                        text = stringResource(R.string.signature_saved),
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                    LazyRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(savedSignatures, key = { it.id }) { sig ->
                            SavedSignatureThumb(sig = sig, onClick = { onSelectExisting(sig) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SavedSignatureThumb(sig: Signature, onClick: () -> Unit) {
    val bitmap = remember(sig.pngPath) {
        runCatching { BitmapFactory.decodeFile(sig.pngPath) }.getOrNull()
    }
    Box(
        modifier = Modifier
            .size(width = 96.dp, height = 64.dp)
            .background(Color.White, RoundedCornerShape(6.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = sig.name,
                modifier = Modifier.fillMaxSize().padding(4.dp)
            )
        } else {
            Text(sig.name, style = MaterialTheme.typography.labelSmall)
        }
    }
}

/** Draw the captured polylines into a transparent ARGB bitmap. */
private fun rasterise(strokes: List<List<Offset>>, size: IntSize): Bitmap? {
    if (size.width <= 0 || size.height <= 0) return null
    if (strokes.all { it.size < 2 }) return null
    val bitmap = Bitmap.createBitmap(size.width, size.height, Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(bitmap)
    val paint = android.graphics.Paint().apply {
        color = android.graphics.Color.BLACK
        strokeWidth = 5f
        style = android.graphics.Paint.Style.STROKE
        strokeCap = android.graphics.Paint.Cap.ROUND
        strokeJoin = android.graphics.Paint.Join.ROUND
        isAntiAlias = true
    }
    for (path in strokes) {
        for (i in 0 until path.size - 1) {
            canvas.drawLine(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y, paint)
        }
    }
    return bitmap
}
