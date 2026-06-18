package com.vikingstech.masterpdf.domain.usecase

import android.graphics.Bitmap
import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.util.Resource
import javax.inject.Inject

class RenderPageUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    suspend operator fun invoke(
        documentId: String,
        pageIndex: Int,
        targetWidthPx: Int
    ): Resource<Bitmap> = documentRepository.renderPage(documentId, pageIndex, targetWidthPx)
}
