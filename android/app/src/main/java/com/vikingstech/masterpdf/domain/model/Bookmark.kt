package com.vikingstech.masterpdf.domain.model

data class Bookmark(
    val id: Long = 0,
    val documentId: String,
    val pageIndex: Int,
    val label: String,
    val createdAt: Long = System.currentTimeMillis()
)
