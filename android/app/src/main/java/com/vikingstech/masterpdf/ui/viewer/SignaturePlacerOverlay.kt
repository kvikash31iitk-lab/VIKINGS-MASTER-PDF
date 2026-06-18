package com.vikingstech.masterpdf.ui.viewer

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.OpenInFull
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.domain.model.Signature
import kotlin.math.roundToInt

/**
 * Overlays a draggable, resizable signature image across the viewer content. On
 * commit the box is reported as normalised fractions (0..1) of the overlay's own
 * bounds; the caller maps those onto the target page's geometry.
 */
@Composable
fun SignaturePlacerOverlay(
    signature: Signature,
    onCommit: (normX: Float, normY: Float, normW: Float, normH: Float) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    val bitmap = remember(signature.pngPath) {
        runCatching { BitmapFactory.decodeFile(signature.pngPath) }.getOrNull()
    }

    var offsetX by remember { mutableFloatStateOf(with(density) { 48.dp.toPx() }) }
    var offsetY by remember { mutableFloatStateOf(with(density) { 96.dp.toPx() }) }
    var widthPx by remember { mutableFloatStateOf(with(density) { 200.dp.toPx() }) }
    var heightPx by remember { mutableFloatStateOf(with(density) { 80.dp.toPx() }) }
    var containerSize by remember { mutableStateOf(IntSize.Zero) }
    val handlePx = with(density) { 28.dp.toPx() }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .onSizeChanged { containerSize = it }
    ) {
        if (bitmap != null) {
            Box(
                modifier = Modifier
                    .offset { IntOffset(offsetX.roundToInt(), offsetY.roundToInt()) }
                    .size(
                        width = with(density) { widthPx.toDp() },
                        height = with(density) { heightPx.toDp() }
                    )
                    .border(1.dp, MaterialTheme.colorScheme.primary)
                    .pointerInput(Unit) {
                        detectDragGestures { change, drag ->
                            change.consume()
                            offsetX = (offsetX + drag.x).coerceIn(0f, (containerSize.width - widthPx).coerceAtLeast(0f))
                            offsetY = (offsetY + drag.y).coerceIn(0f, (containerSize.height - heightPx).coerceAtLeast(0f))
                        }
                    }
            ) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = signature.name,
                    modifier = Modifier.fillMaxSize()
                )
                // Resize handle (bottom-right corner).
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .size(28.dp)
                        .background(MaterialTheme.colorScheme.primary, CircleShape)
                        .pointerInput(Unit) {
                            detectDragGestures { change, drag ->
                                change.consume()
                                widthPx = (widthPx + drag.x).coerceIn(handlePx * 2, containerSize.width.toFloat())
                                heightPx = (heightPx + drag.y).coerceIn(handlePx * 2, containerSize.height.toFloat())
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Filled.OpenInFull,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        // Floating action bar.
        Row(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(onClick = onCancel) { Text(stringResource(R.string.generic_cancel)) }
            Button(
                onClick = {
                    val c = containerSize
                    if (c.width > 0 && c.height > 0) {
                        onCommit(
                            offsetX / c.width,
                            offsetY / c.height,
                            widthPx / c.width,
                            heightPx / c.height
                        )
                    }
                }
            ) {
                Text(stringResource(R.string.signature_commit))
            }
        }
    }
}
