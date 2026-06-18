package com.vikingstech.masterpdf.data.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "recents")
data class RecentEntity(
    @PrimaryKey val uri: String,
    val name: String,
    val pageCount: Int,
    val sizeBytes: Long,
    val lastPageIndex: Int = 0,
    val lastOpenedAt: Long,
    val isPinned: Boolean = false,
    /** Absolute path to a cached page-0 thumbnail (nullable; added in schema v2). */
    val thumbnailUri: String? = null
)
