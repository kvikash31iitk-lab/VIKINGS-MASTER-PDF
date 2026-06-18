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

    /** Extract the embedded text layer of the entire document. */
    suspend fun extractAllText(documentId: String): Resource<String>

    suspend fun reorderPages(documentId: String, newOrder: List<Int>): Resource<Unit>

    suspend fun deletePages(documentId: String, pageIndices: List<Int>): Resource<Unit>

    suspend fun rotatePages(documentId: String, pageIndices: List<Int>, degrees: Int): Resource<Unit>

    /** Persist the (possibly mutated) document to [destinationUri]; returns it. */
    suspend fun save(documentId: String, destinationUri: String): Resource<String>

    suspend fun addInkAnnotation(documentId: String, annotation: InkAnnotation): Resource<Unit>

    suspend fun getFormFields(documentId: String): Resource<List<PdfFormField>>

    suspend fun fillFormField(documentId: String, fieldName: String, value: String): Resource<Unit>

    /** Re-encode embedded images at [quality] (0..1) and write to [destinationUri]. */
    suspend fun compress(documentId: String, quality: Float, destinationUri: String): Resource<String>

    /** Merge [sourceUris] (in order) into a new PDF at [destinationUri]. */
    suspend fun mergeDocuments(sourceUris: List<String>, destinationUri: String): Resource<String>

    /**
     * Stamp a raster image (PNG bytes) onto [pageIndex]. Coordinates are PDF
     * user-space points with a bottom-left origin.
     */
    suspend fun addImageAnnotation(
        documentId: String,
        pageIndex: Int,
        imageBytes: ByteArray,
        xPts: Float,
        yPts: Float,
        widthPts: Float,
        heightPts: Float
    ): Resource<Unit>

    /** Render page 0 to a cached JPEG thumbnail; returns its absolute path. */
    suspend fun generateThumbnail(documentId: String, widthPx: Int = 120): Resource<String>

    fun close(documentId: String)
}
