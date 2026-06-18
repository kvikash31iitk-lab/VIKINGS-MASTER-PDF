package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.repository.RecentsRepository
import javax.inject.Inject

/** Persists the last-read page so "Continue Reading" can restore the position. */
class UpdateLastPageUseCase @Inject constructor(
    private val recentsRepository: RecentsRepository
) {
    suspend operator fun invoke(uri: String, pageIndex: Int) =
        recentsRepository.updateLastPage(uri, pageIndex)
}
