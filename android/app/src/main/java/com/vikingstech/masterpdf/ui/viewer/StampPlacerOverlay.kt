package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.domain.model.CustomStamp
import kotlin.math.roundToInt

/**
 * Draggable, resizable placement preview for a single [stamp], scoped to a page
 * box. On commit it reports the box as normalised fractions (0..1) of its own
 * bounds — which, because it fills the page item, are page-relative. The caller
 * maps those onto PDF user-space for the target page.
 */
@Composable
fun StampPlacerOverlay(
    stamp: CustomStamp,
    onCommit: (normX: Float, normY: Float, normW: Float, normH: Float) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current

    var offsetX by remember { mutableFloatStateOf(with(density) { 32.dp.toPx() }) }
    var offsetY by remember { mutableFloatStateOf(with(density) { 64.dp.toPx() }) }
    var widthPx by remember { mutableFloatStateOf(with(density) { 140.dp.toPx() }) }
    var heightPx by remember { mutableFloatStateOf(with(density) { 64.dp.toPx() }) }
    var containerSize by remember { mutableStateOf(IntSize.Zero) }
    val handlePx = with(density) { 28.dp.toPx() }

    Box(
        modifier = modifier
            .fillMaxSize()
            .onSizeChanged { containerSize = it }
    ) {
        Box(
            modifier = Modifier
                .offset { IntOffset(offsetX.roundToInt(), offsetY.roundToInt()) }
                .size(
                    width = with(density) { widthPx.toDp() },
                    height = with(density) { heightPx.toDp() }
                )
                .shadow(4.dp, RoundedCornerShape(stamp.borderRadius.dp))
                .background(stamp.backgroundColor, RoundedCornerShape(stamp.borderRadius.dp))
                .border(
                    width = stamp.borderWidth.dp,
                    color = stamp.borderColor,
                    shape = RoundedCornerShape(stamp.borderRadius.dp)
                )
                .pointerInput(Unit) {
                    detectDragGestures { change, drag ->
                        change.consume()
                        offsetX = (offsetX + drag.x).coerceIn(0f, (containerSize.width - widthPx).coerceAtLeast(0f))
                        offsetY = (offsetY + drag.y).coerceIn(0f, (containerSize.height - heightPx).coerceAtLeast(0f))
                    }
                },
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = stamp.text,
                color = stamp.textColor,
                fontSize = stamp.fontSize.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 8.dp)
            )

            // Crop-mark decorations.
            Box(modifier = Modifier.align(Alignment.TopStart).size(5.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
            Box(modifier = Modifier.align(Alignment.TopEnd).size(5.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
            Box(modifier = Modifier.align(Alignment.BottomStart).size(5.dp).background(MaterialTheme.colorScheme.primary, CircleShape))

            // Resize handle (bottom-right corner).
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .offset(6.dp, 6.dp)
                    .size(28.dp)
                    .shadow(4.dp, CircleShape)
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
                    tint = Color.White,
                    modifier = Modifier.size(14.dp)
                )
            }
        }

        // Floating action bar.
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
                        text = stringResource(R.string.viewer_apply),
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }
        }
    }
}
