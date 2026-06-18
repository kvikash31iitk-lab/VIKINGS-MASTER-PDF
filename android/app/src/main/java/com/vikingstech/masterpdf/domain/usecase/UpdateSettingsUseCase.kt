package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.AppSettings
import com.vikingstech.masterpdf.domain.repository.SettingsRepository
import javax.inject.Inject

class UpdateSettingsUseCase @Inject constructor(
    private val settingsRepository: SettingsRepository
) {
    suspend operator fun invoke(settings: AppSettings) = settingsRepository.update(settings)
}
