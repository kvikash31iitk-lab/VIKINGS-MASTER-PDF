package com.vikingstech.masterpdf.domain.repository

import com.vikingstech.masterpdf.domain.model.AppSettings
import kotlinx.coroutines.flow.Flow

interface SettingsRepository {
    fun observeSettings(): Flow<AppSettings>
    suspend fun update(settings: AppSettings)
}
