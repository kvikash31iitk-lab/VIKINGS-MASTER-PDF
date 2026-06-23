package com.vikingstech.masterpdf.fakes

import android.graphics.Bitmap
import com.vikingstech.masterpdf.domain.model.Bookmark
import com.vikingstech.masterpdf.domain.model.ChatMessage
import com.vikingstech.masterpdf.domain.model.CustomStamp
import com.vikingstech.masterpdf.domain.model.InkAnnotation
import com.vikingstech.masterpdf.domain.model.PdfDocument
import com.vikingstech.masterpdf.domain.model.PdfFormField
import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.domain.model.Signature
import com.vikingstech.masterpdf.domain.repository.AiRepository
import com.vikingstech.masterpdf.domain.repository.BookmarkRepository
import com.vikingstech.masterpdf.domain.repository.CustomStampRepository
import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.repository.RecentsRepository
import com.vikingstech.masterpdf.domain.repository.SignatureRepository
import com.vikingstech.masterpdf.domain.util.Resource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.emptyFlow

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

/**
 * Configurable document repository for ViewModel tests. By default [openDocument]
 * succeeds so a ViewModel that opens on init reaches a ready state; [pages] and
 * [formFields] feed the geometry/forms the ViewModel reads. Edit calls are
 * recorded so tests can assert routing (e.g. correct page index).
 */
class FakeDocumentRepository : DocumentRepository {

    var openSucceeds: Boolean = true
    var pages: List<PdfPageInfo> = emptyList()
    var formFields: List<PdfFormField> = emptyList()

    val inkAnnotations = mutableListOf<InkAnnotation>()
    val textStampPages = mutableListOf<Int>()
    val imageAnnotationPages = mutableListOf<Int>()
    val filledFields = mutableListOf<Map<String, String>>()
    val deletedPageRequests = mutableListOf<List<Int>>()

    override suspend fun openDocument(uri: String): Resource<PdfDocument> =
        if (openSucceeds) {
            Resource.Success(
                PdfDocument(id = uri, uri = uri, name = "test.pdf", pageCount = pages.size, sizeBytes = 0L)
            )
        } else {
            Resource.Error("not implemented")
        }

    override suspend fun getPageInfo(documentId: String): List<PdfPageInfo> = pages

    override suspend fun renderPage(documentId: String, pageIndex: Int, targetWidthPx: Int): Resource<Bitmap> =
        Resource.Error("not implemented")

    override suspend fun extractText(documentId: String, pageIndex: Int): Resource<String> =
        Resource.Success("")

    override suspend fun extractAllText(documentId: String): Resource<String> =
        Resource.Success("")

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
        Resource.Success(formFields)

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
    ): Resource<Unit> {
        imageAnnotationPages.add(pageIndex)
        return Resource.Success(Unit)
    }

    override suspend fun generateThumbnail(documentId: String, widthPx: Int): Resource<String> =
        Resource.Error("not implemented")

    override fun close(documentId: String) = Unit
}

/** In-memory custom-stamp repository. */
class FakeCustomStampRepository(
    initial: List<CustomStamp> = emptyList()
) : CustomStampRepository {
    val state = MutableStateFlow(initial)
    val saved = mutableListOf<CustomStamp>()

    override fun observeStamps(): Flow<List<CustomStamp>> = state
    override suspend fun getById(id: String): CustomStamp? = state.value.find { it.id == id }
    override suspend fun save(stamp: CustomStamp) {
        saved.add(stamp)
        state.value = state.value + stamp
    }
    override suspend fun delete(id: String) {
        state.value = state.value.filterNot { it.id == id }
    }
}

/** In-memory bookmark repository. */
class FakeBookmarkRepository : BookmarkRepository {
    val state = MutableStateFlow<List<Bookmark>>(emptyList())
    val added = mutableListOf<Bookmark>()
    val deleted = mutableListOf<Long>()

    override fun observeBookmarks(documentId: String): Flow<List<Bookmark>> = state
    override suspend fun add(bookmark: Bookmark) {
        added.add(bookmark)
        state.value = state.value + bookmark
    }
    override suspend fun delete(id: Long) {
        deleted.add(id)
        state.value = state.value.filterNot { it.id == id }
    }
}

/** In-memory signature repository. */
class FakeSignatureRepository : SignatureRepository {
    val state = MutableStateFlow<List<Signature>>(emptyList())

    override fun observeSignatures(): Flow<List<Signature>> = state
    override suspend fun add(name: String, pngBytes: ByteArray): Resource<Signature> {
        val sig = Signature(id = state.value.size + 1L, name = name, pngPath = "/tmp/$name.png")
        state.value = state.value + sig
        return Resource.Success(sig)
    }
    override suspend fun delete(id: Long) {
        state.value = state.value.filterNot { it.id == id }
    }
}

/** No-op AI repository. */
class FakeAiRepository : AiRepository {
    override fun streamChat(messages: List<ChatMessage>): Flow<String> = emptyFlow()
}
