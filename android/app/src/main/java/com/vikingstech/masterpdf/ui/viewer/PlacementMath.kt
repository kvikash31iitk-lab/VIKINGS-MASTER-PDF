package com.vikingstech.masterpdf.ui.viewer

import com.vikingstech.masterpdf.domain.model.DrawingStroke
import com.vikingstech.masterpdf.domain.model.InkAnnotation
import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import com.vikingstech.masterpdf.domain.model.StrokePoint

/**
 * Pure coordinate-conversion helpers shared by drawing, signature and stamp
 * placement. Kept free of Android/Compose types so they are trivially unit
 * testable (see PlacementMathTest), mirroring the top-level helpers used by
 * HomeViewModel.
 *
 * Convention:
 *  - UI placement is expressed as fractions (0..1) of the *page box* with a
 *    top-left origin (y grows downward), which is how Compose reports coords.
 *  - PDF user-space has a bottom-left origin (y grows upward) measured in points.
 *  - PdfRenderer reports page geometry in points, so [PdfPageInfo.widthPx]/
 *    [PdfPageInfo.heightPx] are used directly as the page's point dimensions.
 */

/** A rectangle in PDF user-space points (bottom-left origin). */
data class PdfRect(val x: Float, val y: Float, val width: Float, val height: Float)

/**
 * Maps a normalized, top-left-origin box to a PDF user-space rectangle.
 * [normX]/[normY] are the box's top-left corner; [normW]/[normH] its size.
 */
fun normalizedRectToPdf(
    normX: Float,
    normY: Float,
    normW: Float,
    normH: Float,
    pageWidthPts: Float,
    pageHeightPts: Float
): PdfRect {
    val w = normW * pageWidthPts
    val h = normH * pageHeightPts
    val x = normX * pageWidthPts
    // Flip Y: a top-left box at normY maps to a bottom-left rect whose lower edge
    // is (pageHeight - (normY + normH) * pageHeight).
    val y = pageHeightPts - (normY * pageHeightPts) - h
    return PdfRect(x = x, y = y, width = w, height = h)
}

/** Maps a single normalized, top-left-origin point to PDF user-space points. */
fun normalizedPointToPdf(
    normX: Float,
    normY: Float,
    pageWidthPts: Float,
    pageHeightPts: Float
): StrokePoint = StrokePoint(
    x = normX * pageWidthPts,
    y = pageHeightPts - (normY * pageHeightPts)
)

/**
 * Converts per-page normalized strokes into [InkAnnotation]s whose points are in
 * PDF user-space (ready for the manipulator to draw verbatim). Pages without
 * geometry, or strokes with fewer than two points, are dropped.
 */
fun buildInkAnnotations(
    pageStrokes: Map<Int, List<DrawingStroke>>,
    pages: List<PdfPageInfo>
): List<InkAnnotation> = pageStrokes.mapNotNull { (pageIndex, strokes) ->
    val page = pages.getOrNull(pageIndex) ?: return@mapNotNull null
    val pageW = page.widthPx.toFloat()
    val pageH = page.heightPx.toFloat()
    val converted = strokes
        .filter { it.points.size >= 2 }
        .map { stroke ->
            stroke.copy(
                pageIndex = pageIndex,
                points = stroke.points.map { normalizedPointToPdf(it.x, it.y, pageW, pageH) }
            )
        }
    if (converted.isEmpty()) null else InkAnnotation(pageIndex = pageIndex, strokes = converted)
}

/**
 * Whether an opened source must be materialized into a private working file
 * before reading. Transient `content://` grants (ACTION_VIEW "Open with…") can
 * disappear before later edit/save reads, so they are copied eagerly; persisted
 * grants and `file://` sources can be read directly.
 */
fun shouldMaterializeSource(scheme: String?, isPersisted: Boolean): Boolean =
    scheme == "content" && !isPersisted
