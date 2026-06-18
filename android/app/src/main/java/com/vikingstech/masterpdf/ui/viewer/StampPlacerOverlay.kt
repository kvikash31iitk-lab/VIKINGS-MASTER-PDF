package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vikingstech.masterpdf.domain.model.CustomStamp
import com.vikingstech.masterpdf.domain.model.StampPlacement

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
            .fillMaxWidth()
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
                                        width = 80f,
                                        height = 40f
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
    Box(
        modifier = Modifier
            .background(
                color = stamp.backgroundColor,
                shape = RoundedCornerShape(stamp.borderRadius.dp)
            )
            .border(
                width = stamp.borderWidth.dp,
                color = stamp.borderColor,
                shape = RoundedCornerShape(stamp.borderRadius.dp)
            )
            .clickable { onRemove() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = stamp.text,
            color = stamp.textColor,
            fontSize = stamp.fontSize.sp,
            textAlign = TextAlign.Center
        )
    }
}
