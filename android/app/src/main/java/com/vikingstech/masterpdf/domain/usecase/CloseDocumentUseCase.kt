package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import javax.inject.Inject

class CloseDocumentUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    operator fun invoke(documentId: String) = documentRepository.close(documentId)
}
