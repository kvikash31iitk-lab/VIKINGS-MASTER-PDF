package com.vikingstech.masterpdf.domain.model

/** A reusable hand-drawn or imported signature, persisted as a local PNG. */
data class Signature(
    val id: Long = 0,
    val name: String,
    val pngPath: String,
    val createdAt: Long = System.currentTimeMillis()
)
