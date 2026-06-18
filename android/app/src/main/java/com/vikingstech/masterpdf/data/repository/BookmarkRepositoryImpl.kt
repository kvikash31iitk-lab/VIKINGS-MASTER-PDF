package com.vikingstech.masterpdf.data.repository

import com.vikingstech.masterpdf.data.database.dao.BookmarkDao
import com.vikingstech.masterpdf.data.database.mapper.toDomain
import com.vikingstech.masterpdf.data.database.mapper.toEntity
import com.vikingstech.masterpdf.domain.model.Bookmark
import com.vikingstech.masterpdf.domain.repository.BookmarkRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BookmarkRepositoryImpl @Inject constructor(
    private val bookmarkDao: BookmarkDao
) : BookmarkRepository {

    override fun observeBookmarks(documentId: String): Flow<List<Bookmark>> =
        bookmarkDao.observeForDocument(documentId).map { rows -> rows.map { it.toDomain() } }

    override suspend fun add(bookmark: Bookmark) {
        bookmarkDao.insert(bookmark.toEntity())
    }

    override suspend fun delete(id: Long) = bookmarkDao.delete(id)
}
