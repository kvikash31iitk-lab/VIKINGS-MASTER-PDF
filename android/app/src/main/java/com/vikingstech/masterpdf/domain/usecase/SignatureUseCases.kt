package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.Signature
import com.vikingstech.masterpdf.domain.repository.SignatureRepository
import com.vikingstech.masterpdf.domain.util.Resource
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class ObserveSignaturesUseCase @Inject constructor(
    private val signatureRepository: SignatureRepository
) {
    operator fun invoke(): Flow<List<Signature>> = signatureRepository.observeSignatures()
}

class AddSignatureUseCase @Inject constructor(
    private val signatureRepository: SignatureRepository
) {
    suspend operator fun invoke(name: String, pngBytes: ByteArray): Resource<Signature> =
        signatureRepository.add(name, pngBytes)
}

class DeleteSignatureUseCase @Inject constructor(
    private val signatureRepository: SignatureRepository
) {
    suspend operator fun invoke(id: Long) = signatureRepository.delete(id)
}
