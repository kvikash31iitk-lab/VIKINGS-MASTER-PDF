package com.vikingstech.masterpdf.domain.model

data class Stamp(
    val id: Long = 0,
    val label: String,
    val type: StampType,
    val colorArgb: Int,
    val createdAt: Long = System.currentTimeMillis()
)

enum class StampType { APPROVED, REJECTED, DRAFT, CONFIDENTIAL, CUSTOM }
