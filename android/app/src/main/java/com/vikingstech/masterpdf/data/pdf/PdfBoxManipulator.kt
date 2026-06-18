package com.vikingstech.masterpdf.data.pdf

import androidx.compose.ui.graphics.toArgb
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle
import com.tom_roush.pdfbox.pdmodel.graphics.color.PDColor
import com.tom_roush.pdfbox.pdmodel.graphics.color.PDDeviceRGB
import com.tom_roush.pdfbox.pdmodel.interactive.annotation.PDAnnotationInk
import com.vikingstech.masterpdf.domain.model.InkAnnotation
import java.io.File

/**
 * Structural page operations backed by PdfBox-Android. Every operation reads
 * [source], mutates in a temp-file-backed PDDocument, and writes a fresh
 * [destination] file so the original is never corrupted on a failed save.
 */
object PdfBoxManipulator {

    fun reorderPages(source: File, destination: File, newOrder: List<Int>) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            val tree = doc.pages
            val current = tree.toList()
            require(newOrder.sorted() == current.indices.toList()) {
                "newOrder must be a permutation of the page indices"
            }
            val reordered = newOrder.map { current[it] }
            current.forEach { tree.remove(it) }
            reordered.forEach { tree.add(it) }
            doc.save(destination)
        }
    }

    fun deletePages(source: File, destination: File, pageIndices: List<Int>) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            // Remove from the back so earlier indices stay valid.
            pageIndices.distinct().sortedDescending().forEach { idx ->
                if (idx in 0 until doc.numberOfPages) doc.removePage(idx)
            }
            doc.save(destination)
        }
    }

    fun rotatePages(source: File, destination: File, pageIndices: List<Int>, degrees: Int) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            pageIndices.distinct().forEach { idx ->
                if (idx in 0 until doc.numberOfPages) {
                    val page = doc.getPage(idx)
                    page.rotation = ((page.rotation + degrees) % 360 + 360) % 360
                }
            }
            doc.save(destination)
        }
    }

    fun fillFormField(source: File, destination: File, fieldName: String, value: String) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            val acroForm = doc.documentCatalog.acroForm
            if (acroForm != null) {
                val field = acroForm.getField(fieldName)
                if (field != null) {
                    field.value = value
                }
            }
            doc.save(destination)
        }
    }

    fun addInkAnnotation(source: File, destination: File, annotation: InkAnnotation) {
        PDDocument.load(source, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            if (annotation.pageIndex !in 0 until doc.numberOfPages) return@use

            val page = doc.getPage(annotation.pageIndex)
            val inkAnnotation = PDAnnotationInk()

            for (stroke in annotation.strokes) {
                val quadPoints = mutableListOf<Float>()
                var minX = Float.MAX_VALUE
                var maxX = Float.MIN_VALUE
                var minY = Float.MAX_VALUE
                var maxY = Float.MIN_VALUE

                for (point in stroke.points) {
                    quadPoints.add(point.x)
                    quadPoints.add(point.y)
                    minX = minOf(minX, point.x)
                    maxX = maxOf(maxX, point.x)
                    minY = minOf(minY, point.y)
                    maxY = maxOf(maxY, point.y)
                }

                if (quadPoints.isNotEmpty()) {
                    val list = mutableListOf<FloatArray>()
                    for (i in 0 until quadPoints.size step 2) {
                        list.add(floatArrayOf(quadPoints[i], quadPoints[i + 1]))
                    }
                    inkAnnotation.inkList = listOf(list)
                }
            }

            val color = annotation.strokes.firstOrNull()?.color
            if (color != null) {
                val argb = color.toArgb()
                val r = ((argb shr 16) and 0xFF) / 255f
                val g = ((argb shr 8) and 0xFF) / 255f
                val b = (argb and 0xFF) / 255f
                inkAnnotation.color = PDColor(floatArrayOf(r, g, b), PDDeviceRGB.INSTANCE)
            }

            val stroke = annotation.strokes.firstOrNull()
            if (stroke != null) {
                inkAnnotation.borderStyle.width = stroke.strokeWidth
            }

            var minX = Float.MAX_VALUE
            var maxX = Float.MIN_VALUE
            var minY = Float.MAX_VALUE
            var maxY = Float.MIN_VALUE

            for (stroke in annotation.strokes) {
                for (point in stroke.points) {
                    minX = minOf(minX, point.x)
                    maxX = maxOf(maxX, point.x)
                    minY = minOf(minY, point.y)
                    maxY = maxOf(maxY, point.y)
                }
            }

            if (minX != Float.MAX_VALUE && maxX != Float.MIN_VALUE) {
                val rect = PDRectangle(minX, minY, maxX - minX, maxY - minY)
                inkAnnotation.rectangle = rect
            }

            page.annotations.add(inkAnnotation)
            doc.save(destination)
        }
    }
}
