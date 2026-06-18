package com.vikingstech.masterpdf.data.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "custom_stamps")
data class CustomStampEntity(
    @PrimaryKey val id: String,
    val name: String,
    val text: String,
    val textColor: Long,
    val backgroundColor: Long,
    val borderColor: Long,
    val borderWidth: Float,
    val fontSize: Float,
    val borderRadius: Float,
    val createdAt: Long
)
