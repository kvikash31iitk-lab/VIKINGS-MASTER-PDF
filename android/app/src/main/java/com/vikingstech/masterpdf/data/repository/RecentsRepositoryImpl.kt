package com.vikingstech.masterpdf.data.repository

import com.vikingstech.masterpdf.data.database.dao.RecentDao
import com.vikingstech.masterpdf.data.database.mapper.toDomain
import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.domain.repository.RecentsRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RecentsRepositoryImpl @Inject constructor(
    private val recentDao: RecentDao
) : RecentsRepository {

    override fun observeRecents(): Flow<List<RecentDocument>> =
        recentDao.observeAll().map { rows -> rows.map { it.toDomain() } }

    override suspend fun upsert(recent: RecentDocument) =
        recentDao.upsertPreservingState(
            uri = recent.uri,
            name = recent.name,
            pageCount = recent.pageCount,
            sizeBytes = recent.sizeBytes,
            openedAt = recent.lastOpenedAt
        )

    override suspend fun setPinned(uri: String, pinned: Boolean) = recentDao.setPinned(uri, pinned)

    override suspend fun updateLastPage(uri: String, pageIndex: Int) =
        recentDao.updateLastPage(uri, pageIndex)

    override suspend fun updateThumbnail(uri: String, path: String?) =
        recentDao.updateThumbnail(uri, path)

    override suspend fun remove(uri: String) = recentDao.remove(uri)

    override suspend fun clear() = recentDao.clear()
}
