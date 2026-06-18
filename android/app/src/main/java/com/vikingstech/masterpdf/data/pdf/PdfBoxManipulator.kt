package com.vikingstech.masterpdf.data.pdf

import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
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
}
