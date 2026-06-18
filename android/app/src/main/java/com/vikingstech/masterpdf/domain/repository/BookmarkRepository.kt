package com.vikingstech.masterpdf.domain.repository

import com.vikingstech.masterpdf.domain.model.Bookmark
import kotlinx.coroutines.flow.Flow

interface BookmarkRepository {
    fun observeBookmarks(documentId: String): Flow<List<Bookmark>>
    suspend fun add(bookmark: Bookmark)
    suspend fun delete(id: Long)
}
