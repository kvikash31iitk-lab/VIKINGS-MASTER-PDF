package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.OpenInFull
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vikingstech.masterpdf.domain.model.CustomStamp
import com.vikingstech.masterpdf.domain.model.StampPlacement
import kotlin.math.roundToInt

@Composable
fun StampPlacerOverlay(
    containerWidthPx: Int,
    containerHeightPx: Int,
    placements: List<StampPlacement>,
    stamps: Map<String, CustomStamp>,
    selectedStampForPlacement: String?,
    isPlacingMode: Boolean,
    onStampPlaced: (StampPlacement) -> Unit,
    onRemoveStamp: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .pointerInput(isPlacingMode) {
                if (!isPlacingMode) return@pointerInput

                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Main)
                        event.changes.forEach { change ->
                            if (change.pressed && !change.previousPressed) {
                                val position = change.position
                                selectedStampForPlacement?.let { stampId ->
                                    val placement = StampPlacement(
                                        stampId = stampId,
                                        pageIndex = 0,
                                        x = position.x,
                                        y = position.y,
                                        width = 120f,
                                        height = 60f
                                    )
                                    onStampPlaced(placement)
                                }
                            }
                            change.consume()
                        }
                    }
                }
            }
    ) {
        placements.forEachIndexed { index, placement ->
            stamps[placement.stampId]?.let { stamp ->
                StampView(
                    stamp = stamp,
                    placement = placement,
                    onRemove = { onRemoveStamp(index) }
                )
            }
        }
    }
}

@Composable
private fun StampView(
    stamp: CustomStamp,
    placement: StampPlacement,
    onRemove: () -> Unit
) {
    val density = LocalDensity.current
    var offsetX by remember { mutableFloatStateOf(placement.x) }
    var offsetY by remember { mutableFloatStateOf(placement.y) }
    
    // Convert initial width/height from DP to Pixels for manipulation
    var widthPx by remember { mutableFloatStateOf(with(density) { placement.width.dp.toPx() }) }
    var heightPx by remember { mutableFloatStateOf(with(density) { placement.height.dp.toPx() }) }
    
    val originalAspectRatio = placement.width / placement.height
    
    val widthDp = with(density) { widthPx.toDp() }
    val heightDp = with(density) { heightPx.toDp() }

    Box(
        modifier = Modifier
            .offset { IntOffset(offsetX.roundToInt(), offsetY.roundToInt()) }
            .size(width = widthDp, height = heightDp)
            .shadow(4.dp, RoundedCornerShape(stamp.borderRadius.dp))
            .background(
                color = stamp.backgroundColor,
                shape = RoundedCornerShape(stamp.borderRadius.dp)
            )
            .border(
                width = stamp.borderWidth.dp,
                color = stamp.borderColor,
                shape = RoundedCornerShape(stamp.borderRadius.dp)
            )
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f),
                shape = RoundedCornerShape(stamp.borderRadius.dp)
            )
            .pointerInput(Unit) {
                detectDragGestures { change, drag ->
                    change.consume()
                    offsetX += drag.x
                    offsetY += drag.y
                }
            },
        contentAlignment = Alignment.Center
    ) {
        // Calculate dynamic font size based on scale
        val scale = widthPx / with(density) { placement.width.dp.toPx() }
        val fontSize = (stamp.fontSize * scale).coerceAtLeast(8f)

        Text(
            text = stamp.text,
            color = stamp.textColor,
            fontSize = fontSize.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 8.dp)
        )

        // Corner crop decoration marks
        Box(modifier = Modifier.align(Alignment.TopStart).size(4.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
        Box(modifier = Modifier.align(Alignment.TopEnd).size(4.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
        Box(modifier = Modifier.align(Alignment.BottomStart).size(4.dp).background(MaterialTheme.colorScheme.primary, CircleShape))

        // Visual remove button in the top-right corner
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .offset(4.dp, (-4).dp)
                .size(16.dp)
                .shadow(2.dp, CircleShape)
                .background(Color.Red, CircleShape)
                .clickable { onRemove() },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = "Remove stamp",
                tint = Color.White,
                modifier = Modifier.size(10.dp)
            )
        }

        // Resize handle at bottom-right corner
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(4.dp, 4.dp)
                .size(20.dp)
                .shadow(2.dp, CircleShape)
                .background(MaterialTheme.colorScheme.primary, CircleShape)
                .pointerInput(originalAspectRatio) {
                    detectDragGestures { change, drag ->
                        change.consume()
                        val newWidth = (widthPx + drag.x).coerceIn(
                            with(density) { 40.dp.toPx() },
                            with(density) { 300.dp.toPx() }
                        )
                        widthPx = newWidth
                        heightPx = newWidth / originalAspectRatio
                    }
                },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Filled.OpenInFull,
                contentDescription = "Resize stamp",
                tint = Color.White,
                modifier = Modifier.size(10.dp)
            )
        }
    }
}
