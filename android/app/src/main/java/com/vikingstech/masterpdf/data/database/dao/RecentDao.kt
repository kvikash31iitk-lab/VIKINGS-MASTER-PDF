package com.vikingstech.masterpdf.data.database.dao

import androidx.room.Dao
import androidx.room.Query
import com.vikingstech.masterpdf.data.database.entity.RecentEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface RecentDao {
    @Query("SELECT * FROM recents ORDER BY isPinned DESC, lastOpenedAt DESC")
    fun observeAll(): Flow<List<RecentEntity>>

    /**
     * SQLite upsert that preserves pin state and last-read position when an
     * already-seen document is re-opened (a plain REPLACE would reset them).
     */
    @Query(
        """
        INSERT INTO recents (uri, name, pageCount, sizeBytes, lastPageIndex, lastOpenedAt, isPinned)
        VALUES (:uri, :name, :pageCount, :sizeBytes, 0, :openedAt, 0)
        ON CONFLICT(uri) DO UPDATE SET
            name = :name,
            pageCount = :pageCount,
            sizeBytes = :sizeBytes,
            lastOpenedAt = :openedAt
        """
    )
    suspend fun upsertPreservingState(
        uri: String,
        name: String,
        pageCount: Int,
        sizeBytes: Long,
        openedAt: Long
    )

    @Query("UPDATE recents SET isPinned = :pinned WHERE uri = :uri")
    suspend fun setPinned(uri: String, pinned: Boolean)

    @Query("UPDATE recents SET lastPageIndex = :pageIndex WHERE uri = :uri")
    suspend fun updateLastPage(uri: String, pageIndex: Int)

    @Query("DELETE FROM recents WHERE uri = :uri")
    suspend fun remove(uri: String)

    @Query("DELETE FROM recents")
    suspend fun clear()
}
