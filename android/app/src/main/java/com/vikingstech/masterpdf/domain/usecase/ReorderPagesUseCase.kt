package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.util.Resource
import javax.inject.Inject

class ReorderPagesUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    suspend operator fun invoke(documentId: String, newOrder: List<Int>): Resource<Unit> =
        documentRepository.reorderPages(documentId, newOrder)
}
