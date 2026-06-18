package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import javax.inject.Inject

class GetPageInfoUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    suspend operator fun invoke(documentId: String): List<PdfPageInfo> =
        documentRepository.getPageInfo(documentId)
}
