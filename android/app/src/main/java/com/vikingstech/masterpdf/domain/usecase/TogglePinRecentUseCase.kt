package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.repository.RecentsRepository
import javax.inject.Inject

class TogglePinRecentUseCase @Inject constructor(
    private val recentsRepository: RecentsRepository
) {
    suspend operator fun invoke(uri: String, pinned: Boolean) =
        recentsRepository.setPinned(uri, pinned)
}
