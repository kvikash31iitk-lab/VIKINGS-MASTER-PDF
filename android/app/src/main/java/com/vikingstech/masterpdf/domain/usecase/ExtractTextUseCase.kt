package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.util.Resource
import javax.inject.Inject

class ExtractTextUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    suspend operator fun invoke(documentId: String, pageIndex: Int): Resource<String> =
        documentRepository.extractText(documentId, pageIndex)
}
