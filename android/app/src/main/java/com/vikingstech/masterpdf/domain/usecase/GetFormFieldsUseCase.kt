package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.PdfFormField
import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.util.Resource
import javax.inject.Inject

class GetFormFieldsUseCase @Inject constructor(
    private val documentRepository: DocumentRepository
) {
    suspend operator fun invoke(documentId: String): Resource<List<PdfFormField>> {
        return documentRepository.getFormFields(documentId)
    }
}
