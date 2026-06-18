package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.PdfDocument
import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.repository.RecentsRepository
import com.vikingstech.masterpdf.domain.util.Resource
import javax.inject.Inject

/** Opens a document and, on success, records it in the recents list. */
class OpenDocumentUseCase @Inject constructor(
    private val documentRepository: DocumentRepository,
    private val recentsRepository: RecentsRepository
) {
    suspend operator fun invoke(uri: String): Resource<PdfDocument> {
        val result = documentRepository.openDocument(uri)
        if (result is Resource.Success) {
            val doc = result.data
            recentsRepository.upsert(
                RecentDocument(
                    uri = doc.uri,
                    name = doc.name,
                    pageCount = doc.pageCount,
                    sizeBytes = doc.sizeBytes
                )
            )
            // Best-effort page-0 thumbnail; never fails the open if it can't render.
            (documentRepository.generateThumbnail(doc.id) as? Resource.Success)?.let { thumb ->
                recentsRepository.updateThumbnail(doc.uri, thumb.data)
            }
        }
        return result
    }
}
