package com.vikingstech.masterpdf.domain.repository

import com.vikingstech.masterpdf.domain.model.RecentDocument
import kotlinx.coroutines.flow.Flow

interface RecentsRepository {
    fun observeRecents(): Flow<List<RecentDocument>>
    suspend fun upsert(recent: RecentDocument)
    suspend fun setPinned(uri: String, pinned: Boolean)
    suspend fun updateLastPage(uri: String, pageIndex: Int)
    suspend fun updateThumbnail(uri: String, path: String?)
    suspend fun remove(uri: String)
    suspend fun clear()
}
