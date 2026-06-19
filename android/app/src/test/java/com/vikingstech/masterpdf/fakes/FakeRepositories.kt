package com.vikingstech.masterpdf.fakes

import android.graphics.Bitmap
import com.vikingstech.masterpdf.domain.model.InkAnnotation
import com.vikingstech.masterpdf.domain.model.PdfDocument
import com.vikingstech.masterpdf.domain.model.PdfFormField
import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.repository.RecentsRepository
import com.vikingstech.masterpdf.domain.util.Resource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow

/** In-memory recents repository for ViewModel tests. */
class FakeRecentsRepository(
    initial: List<RecentDocument> = emptyList()
) : RecentsRepository {
    val state = MutableStateFlow(initial)
    val pinnedCalls = mutableListOf<Pair<String, Boolean>>()
    val removedUris = mutableListOf<String>()

    override fun observeRecents(): Flow<List<RecentDocument>> = state

    override suspend fun upsert(recent: RecentDocument) {
        state.value = state.value.filterNot { it.uri == recent.uri } + recent
    }

    override suspend fun setPinned(uri: String, pinned: Boolean) {
        pinnedCalls.add(uri to pinned)
    }

    override suspend fun updateLastPage(uri: String, pageIndex: Int) = Unit

    override suspend fun updateThumbnail(uri: String, path: String?) = Unit

    override suspend fun remove(uri: String) {
        removedUris.add(uri)
        state.value = state.value.filterNot { it.uri == uri }
    }

    override suspend fun clear() {
        state.value = emptyList()
    }
}

/** No-op document repository; ViewModel tests that need it never open a document. */
class FakeDocumentRepository : DocumentRepository {

    /** Records edit calls so tests can assert routing (e.g. correct page index). */
    val inkAnnotations = mutableListOf<InkAnnotation>()
    val textStampPages = mutableListOf<Int>()
    val filledFields = mutableListOf<Map<String, String>>()
    val deletedPageRequests = mutableListOf<List<Int>>()

    override suspend fun openDocument(uri: String): Resource<PdfDocument> =
        Resource.Error("not implemented")

    override suspend fun getPageInfo(documentId: String): List<PdfPageInfo> = emptyList()

    override suspend fun renderPage(documentId: String, pageIndex: Int, targetWidthPx: Int): Resource<Bitmap> =
        Resource.Error("not implemented")

    override suspend fun extractText(documentId: String, pageIndex: Int): Resource<String> =
        Resource.Error("not implemented")

    override suspend fun extractAllText(documentId: String): Resource<String> =
        Resource.Error("not implemented")

    override suspend fun reorderPages(documentId: String, newOrder: List<Int>): Resource<Unit> =
        Resource.Success(Unit)

    override suspend fun deletePages(documentId: String, pageIndices: List<Int>): Resource<Unit> {
        deletedPageRequests.add(pageIndices)
        return Resource.Success(Unit)
    }

    override suspend fun rotatePages(documentId: String, pageIndices: List<Int>, degrees: Int): Resource<Unit> =
        Resource.Success(Unit)

    override suspend fun save(documentId: String, destinationUri: String): Resource<String> =
        Resource.Success(destinationUri)

    override suspend fun addInkAnnotation(documentId: String, annotation: InkAnnotation): Resource<Unit> {
        inkAnnotations.add(annotation)
        return Resource.Success(Unit)
    }

    override suspend fun getFormFields(documentId: String): Resource<List<PdfFormField>> =
        Resource.Success(emptyList())

    override suspend fun fillFormField(documentId: String, fieldName: String, value: String): Resource<Unit> {
        filledFields.add(mapOf(fieldName to value))
        return Resource.Success(Unit)
    }

    override suspend fun fillFormFields(documentId: String, values: Map<String, String>): Resource<Unit> {
        filledFields.add(values)
        return Resource.Success(Unit)
    }

    override suspend fun addTextStamp(
        documentId: String,
        pageIndex: Int,
        text: String,
        textArgb: Int,
        backgroundArgb: Int,
        borderArgb: Int,
        borderWidthPts: Float,
        fontSizePts: Float,
        xPts: Float,
        yPts: Float,
        widthPts: Float,
        heightPts: Float
    ): Resource<Unit> {
        textStampPages.add(pageIndex)
        return Resource.Success(Unit)
    }

    override suspend fun compress(documentId: String, quality: Float, destinationUri: String): Resource<String> =
        Resource.Success(destinationUri)

    override suspend fun mergeDocuments(sourceUris: List<String>, destinationUri: String): Resource<String> =
        Resource.Success(destinationUri)

    override suspend fun addImageAnnotation(
        documentId: String,
        pageIndex: Int,
        imageBytes: ByteArray,
        xPts: Float,
        yPts: Float,
        widthPts: Float,
        heightPts: Float
    ): Resource<Unit> = Resource.Success(Unit)

    override suspend fun generateThumbnail(documentId: String, widthPx: Int): Resource<String> =
        Resource.Error("not implemented")

    override fun close(documentId: String) = Unit
}
