package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.Bookmark
import com.vikingstech.masterpdf.domain.repository.BookmarkRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class ObserveBookmarksUseCase @Inject constructor(
    private val bookmarkRepository: BookmarkRepository
) {
    operator fun invoke(documentId: String): Flow<List<Bookmark>> =
        bookmarkRepository.observeBookmarks(documentId)
}

class AddBookmarkUseCase @Inject constructor(
    private val bookmarkRepository: BookmarkRepository
) {
    suspend operator fun invoke(bookmark: Bookmark) = bookmarkRepository.add(bookmark)
}

class DeleteBookmarkUseCase @Inject constructor(
    private val bookmarkRepository: BookmarkRepository
) {
    suspend operator fun invoke(id: Long) = bookmarkRepository.delete(id)
}
