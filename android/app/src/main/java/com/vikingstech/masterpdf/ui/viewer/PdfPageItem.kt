package com.vikingstech.masterpdf.ui.viewer

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.CircularProgressIndicator
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
import com.vikingstech.masterpdf.domain.model.DrawingStroke
import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import com.vikingstech.masterpdf.domain.model.StrokePoint
import kotlinx.coroutines.flow.SharedFlow

/**
 * Renders one page on demand. A correctly-proportioned placeholder occupies the
 * slot before the bitmap arrives, so the lazy list never shifts as pages stream
 * in. Only composed for visible pages → constant memory for 1000+ page files.
 *
 * The rendered page is wrapped in a [ZoomableBox] for pinch-zoom/pan; the drawing
 * overlay sits above the (untransformed) box so stroke coordinates stay aligned.
 */
@Composable
fun PdfPageItem(
    page: PdfPageInfo,
    render: suspend (pageIndex: Int, targetWidthPx: Int) -> Bitmap?,
    zoomResetEvents: SharedFlow<Unit>,
    onZoomChanged: (Float) -> Unit,
    strokes: List<DrawingStroke> = emptyList(),
    currentPath: List<StrokePoint> = emptyList(),
    strokeColor: Color = Color.Black,
    strokeWidth: Float = 2f,
    isDrawingEnabled: Boolean = false,
    onPointAdded: (StrokePoint) -> Unit = {},
    onStrokeFinished: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    var bitmap by remember(page.index) { mutableStateOf<Bitmap?>(null) }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(page.aspectRatio.coerceAtLeast(0.1f))
            .background(Color.White)
    ) {
        val targetWidthPx = with(density) { maxWidth.roundToPx() }

        LaunchedEffect(page.index, targetWidthPx) {
            if (targetWidthPx > 0) bitmap = render(page.index, targetWidthPx)
        }

        ZoomableBox(
            zoomResetEvents = zoomResetEvents,
            isDrawingEnabled = isDrawingEnabled,
            onZoomChanged = onZoomChanged,
            modifier = Modifier.matchParentSize()
        ) {
            val current = bitmap
            if (current != null) {
                Image(
                    bitmap = current.asImageBitmap(),
                    contentDescription = "Page ${page.index + 1}",
                    modifier = Modifier.fillMaxWidth(),
                    contentScale = ContentScale.FillWidth
                )
            } else {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            }
        }

        if (isDrawingEnabled) {
            DrawingCanvasOverlay(
                strokes = strokes,
                currentPath = currentPath,
                strokeColor = strokeColor,
                strokeWidth = strokeWidth,
                isDrawingEnabled = isDrawingEnabled,
                onPointAdded = onPointAdded,
                onStrokeFinished = onStrokeFinished,
                modifier = Modifier.matchParentSize()
            )
        }
    }
}
