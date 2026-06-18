package com.vikingstech.masterpdf.domain.repository

import android.graphics.Bitmap
import com.vikingstech.masterpdf.domain.model.InkAnnotation
import com.vikingstech.masterpdf.domain.model.PdfDocument
import com.vikingstech.masterpdf.domain.model.PdfFormField
import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import com.vikingstech.masterpdf.domain.util.Resource

/**
 * Owns the lifecycle of opened documents: rendering (native PdfRenderer) and
 * structural manipulation/text (PdfBox-Android). Bitmaps are intentionally part
 * of this Android-centric domain since paged rendering is the app's core.
 */
interface DocumentRepository {
    suspend fun openDocument(uri: String): Resource<PdfDocument>

    suspend fun getPageInfo(documentId: String): List<PdfPageInfo>

    /** Render a single page scaled to [targetWidthPx]; height follows aspect. */
    suspend fun renderPage(documentId: String, pageIndex: Int, targetWidthPx: Int): Resource<Bitmap>

    suspend fun extractText(documentId: String, pageIndex: Int): Resource<String>

    suspend fun reorderPages(documentId: String, newOrder: List<Int>): Resource<Unit>

    suspend fun deletePages(documentId: String, pageIndices: List<Int>): Resource<Unit>

    suspend fun rotatePages(documentId: String, pageIndices: List<Int>, degrees: Int): Resource<Unit>

    /** Persist the (possibly mutated) document to [destinationUri]; returns it. */
    suspend fun save(documentId: String, destinationUri: String): Resource<String>

    suspend fun addInkAnnotation(documentId: String, annotation: InkAnnotation): Resource<Unit>

    suspend fun getFormFields(documentId: String): Resource<List<PdfFormField>>

    suspend fun fillFormField(documentId: String, fieldName: String, value: String): Resource<Unit>

    fun close(documentId: String)
}
