package com.vikingstech.masterpdf.data.repository

import com.vikingstech.masterpdf.data.database.dao.SettingsDao
import com.vikingstech.masterpdf.data.database.mapper.toDomain
import com.vikingstech.masterpdf.data.database.mapper.toEntity
import com.vikingstech.masterpdf.domain.model.AppSettings
import com.vikingstech.masterpdf.domain.repository.SettingsRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SettingsRepositoryImpl @Inject constructor(
    private val settingsDao: SettingsDao
) : SettingsRepository {

    override fun observeSettings(): Flow<AppSettings> =
        settingsDao.observe().map { it?.toDomain() ?: AppSettings() }

    override suspend fun update(settings: AppSettings) = settingsDao.upsert(settings.toEntity())
}
