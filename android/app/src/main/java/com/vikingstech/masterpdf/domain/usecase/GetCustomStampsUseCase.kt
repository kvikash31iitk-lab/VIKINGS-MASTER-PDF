package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.CustomStamp
import com.vikingstech.masterpdf.domain.repository.CustomStampRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetCustomStampsUseCase @Inject constructor(
    private val customStampRepository: CustomStampRepository
) {
    operator fun invoke(): Flow<List<CustomStamp>> = customStampRepository.observeStamps()
}
