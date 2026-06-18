package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.CustomStamp
import com.vikingstech.masterpdf.domain.repository.CustomStampRepository
import javax.inject.Inject

class SaveCustomStampUseCase @Inject constructor(
    private val customStampRepository: CustomStampRepository
) {
    suspend operator fun invoke(stamp: CustomStamp) = customStampRepository.save(stamp)
}
