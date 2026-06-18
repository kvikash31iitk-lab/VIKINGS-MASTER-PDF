package com.vikingstech.masterpdf.data.repository

import com.vikingstech.masterpdf.data.database.dao.CustomStampDao
import com.vikingstech.masterpdf.data.database.mapper.toDomain
import com.vikingstech.masterpdf.data.database.mapper.toEntity
import com.vikingstech.masterpdf.domain.model.CustomStamp
import com.vikingstech.masterpdf.domain.repository.CustomStampRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CustomStampRepositoryImpl @Inject constructor(
    private val customStampDao: CustomStampDao
) : CustomStampRepository {

    override fun observeStamps(): Flow<List<CustomStamp>> =
        customStampDao.observeAll().map { rows -> rows.map { it.toDomain() } }

    override suspend fun getById(id: String): CustomStamp? {
        return customStampDao.getById(id)?.toDomain()
    }

    override suspend fun save(stamp: CustomStamp) {
        customStampDao.insert(stamp.toEntity())
    }

    override suspend fun delete(id: String) {
        customStampDao.delete(id)
    }
}
