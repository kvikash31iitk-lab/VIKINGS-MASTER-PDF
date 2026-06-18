package com.vikingstech.masterpdf.domain.model

/** An opened PDF document and its top-level metadata. */
data class PdfDocument(
    val id: String,
    val uri: String,
    val name: String,
    val pageCount: Int,
    val sizeBytes: Long,
    val isEncrypted: Boolean = false,
    val lastOpenedAt: Long = System.currentTimeMillis()
)
