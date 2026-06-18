package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.repository.RecentsRepository
import javax.inject.Inject

class RemoveRecentUseCase @Inject constructor(
    private val recentsRepository: RecentsRepository
) {
    suspend operator fun invoke(uri: String) = recentsRepository.remove(uri)
}
