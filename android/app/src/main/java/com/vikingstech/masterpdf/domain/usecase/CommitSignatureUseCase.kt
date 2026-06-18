package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.util.Resource
import javax.inject.Inject

/**
 * Commits a signature image onto a page. Coordinates are PDF user-space points
 * (bottom-left origin) so the caller is responsible for mapping from screen space.
 */
class CommitSignatureUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    suspend operator fun invoke(
        documentId: String,
        pageIndex: Int,
        imageBytes: ByteArray,
        xPts: Float,
        yPts: Float,
        widthPts: Float,
        heightPts: Float
    ): Resource<Unit> = documentRepository.addImageAnnotation(
        documentId, pageIndex, imageBytes, xPts, yPts, widthPts, heightPts
    )
}
