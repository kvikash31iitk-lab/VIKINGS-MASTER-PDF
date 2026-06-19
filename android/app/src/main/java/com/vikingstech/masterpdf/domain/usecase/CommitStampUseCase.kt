package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.util.Resource
import javax.inject.Inject

/**
 * Commits a text stamp onto a page. Geometry is PDF user-space points
 * (bottom-left origin) so the caller maps from screen/normalized coordinates.
 * Colours are packed ARGB ints.
 */
class CommitStampUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    suspend operator fun invoke(
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
    ): Resource<Unit> = documentRepository.addTextStamp(
        documentId, pageIndex, text, textArgb, backgroundArgb, borderArgb,
        borderWidthPts, fontSizePts, xPts, yPts, widthPts, heightPts
    )
}
