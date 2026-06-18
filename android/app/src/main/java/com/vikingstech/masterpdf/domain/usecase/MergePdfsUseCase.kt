package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.util.Resource
import javax.inject.Inject

class MergePdfsUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    suspend operator fun invoke(
        sourceUris: List<String>,
        destinationUri: String
    ): Resource<String> = documentRepository.mergeDocuments(sourceUris, destinationUri)
}
