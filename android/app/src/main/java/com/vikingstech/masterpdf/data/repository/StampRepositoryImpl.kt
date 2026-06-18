package com.vikingstech.masterpdf.data.repository

import com.vikingstech.masterpdf.data.database.dao.StampDao
import com.vikingstech.masterpdf.data.database.mapper.toDomain
import com.vikingstech.masterpdf.data.database.mapper.toEntity
import com.vikingstech.masterpdf.domain.model.Stamp
import com.vikingstech.masterpdf.domain.repository.StampRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StampRepositoryImpl @Inject constructor(
    private val stampDao: StampDao
) : StampRepository {

    override fun observeStamps(): Flow<List<Stamp>> =
        stampDao.observeAll().map { rows -> rows.map { it.toDomain() } }

    override suspend fun add(stamp: Stamp) {
        stampDao.insert(stamp.toEntity())
    }

    override suspend fun delete(id: Long) = stampDao.delete(id)
}
