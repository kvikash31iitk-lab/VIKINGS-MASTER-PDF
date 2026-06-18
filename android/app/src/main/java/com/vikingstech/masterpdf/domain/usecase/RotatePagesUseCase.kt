package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.util.Resource
import javax.inject.Inject

class RotatePagesUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    suspend operator fun invoke(
        documentId: String,
        pageIndices: List<Int>,
        degrees: Int
    ): Resource<Unit> = documentRepository.rotatePages(documentId, pageIndices, degrees)
}
