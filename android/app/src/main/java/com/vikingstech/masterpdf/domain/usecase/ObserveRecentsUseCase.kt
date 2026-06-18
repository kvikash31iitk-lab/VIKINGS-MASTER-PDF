package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.domain.repository.RecentsRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class ObserveRecentsUseCase @Inject constructor(
    private val recentsRepository: RecentsRepository
) {
    operator fun invoke(): Flow<List<RecentDocument>> = recentsRepository.observeRecents()
}
