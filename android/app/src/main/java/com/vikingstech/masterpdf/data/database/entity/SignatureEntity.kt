package com.vikingstech.masterpdf.data.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "signatures")
data class SignatureEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val pngPath: String,
    val createdAt: Long
)
