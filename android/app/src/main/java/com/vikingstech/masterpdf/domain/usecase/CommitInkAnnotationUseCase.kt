package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.InkAnnotation
import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import javax.inject.Inject

class CommitInkAnnotationUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    suspend operator fun invoke(documentId: String, annotation: InkAnnotation): Boolean {
        return try {
            documentRepository.addInkAnnotation(documentId, annotation)
            true
        } catch (e: Exception) {
            false
        }
    }
}
