package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.util.Resource
import javax.inject.Inject

class CompressPdfUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    suspend operator fun invoke(
        documentId: String,
        quality: Float,
        destinationUri: String
    ): Resource<String> = documentRepository.compress(documentId, quality, destinationUri)
}
