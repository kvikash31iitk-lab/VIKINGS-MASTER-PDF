package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.AppSettings
import com.vikingstech.masterpdf.domain.repository.SettingsRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class ObserveSettingsUseCase @Inject constructor(
    private val settingsRepository: SettingsRepository
) {
    operator fun invoke(): Flow<AppSettings> = settingsRepository.observeSettings()
}
