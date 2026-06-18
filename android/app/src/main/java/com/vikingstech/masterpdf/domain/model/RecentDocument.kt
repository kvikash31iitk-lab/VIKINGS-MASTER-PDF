package com.vikingstech.masterpdf.domain.model

/** A document surfaced on the Home screen's "Recent" list. */
data class RecentDocument(
    val uri: String,
    val name: String,
    val pageCount: Int,
    val sizeBytes: Long,
    val lastPageIndex: Int = 0,
    val lastOpenedAt: Long = System.currentTimeMillis(),
    val isPinned: Boolean = false
)
