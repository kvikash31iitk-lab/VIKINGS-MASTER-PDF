package com.vikingstech.masterpdf.domain.model

/** A document surfaced on the Home screen's "Recent" list. */
data class RecentDocument(
    val uri: String,
    val name: String,
    val pageCount: Int,
    val sizeBytes: Long,
    val lastPageIndex: Int = 0,
    val lastOpenedAt: Long = System.currentTimeMillis(),
    val isPinned: Boolean = false,
    /** Absolute path to a cached JPEG thumbnail of page 0, or null if not yet generated. */
    val thumbnailUri: String? = null
)
