package com.vikingstech.masterpdf.ui.viewer

import android.graphics.BitmapFactory
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.OpenInFull
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
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
            val originalAspectRatio = remember(bitmap) {
                val w = bitmap.width.coerceAtLeast(1)
                val h = bitmap.height.coerceAtLeast(1)
                w.toFloat() / h.toFloat()
            }

            Box(
                modifier = Modifier
                    .offset { IntOffset(offsetX.roundToInt(), offsetY.roundToInt()) }
                    .size(
                        width = with(density) { widthPx.toDp() },
                        height = with(density) { heightPx.toDp() }
                    )
                    .shadow(4.dp, RoundedCornerShape(4.dp))
                    .background(Color.White.copy(alpha = 0.05f))
                    .border(1.5.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(4.dp))
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
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(4.dp)
                )

                // Visual corners markers (looks like professional crop marks)
                Box(modifier = Modifier.align(Alignment.TopStart).size(6.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
                Box(modifier = Modifier.align(Alignment.TopEnd).size(6.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
                Box(modifier = Modifier.align(Alignment.BottomStart).size(6.dp).background(MaterialTheme.colorScheme.primary, CircleShape))

                // Resize handle (bottom-right corner) with aspect-ratio scaling
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .offset(6.dp, 6.dp)
                        .size(28.dp)
                        .shadow(4.dp, CircleShape)
                        .background(MaterialTheme.colorScheme.primary, CircleShape)
                        .pointerInput(originalAspectRatio) {
                            detectDragGestures { change, drag ->
                                change.consume()
                                val newWidth = (widthPx + drag.x).coerceIn(handlePx * 2f, containerSize.width.toFloat())
                                widthPx = newWidth
                                heightPx = newWidth / originalAspectRatio
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.OpenInFull,
                        contentDescription = "Resize signature",
                        tint = Color.White,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }
        }

        // Floating action bar
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
            shadowElevation = 6.dp,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = onCancel,
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
                ) {
                    Text(
                        text = stringResource(R.string.generic_cancel),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
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
                    },
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = Color.White
                    )
                ) {
                    Text(
                        text = stringResource(R.string.signature_commit),
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }
        }
    }
}
