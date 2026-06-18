package com.vikingstech.masterpdf.data.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "stamps")
data class StampEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val label: String,
    val type: String,
    val colorArgb: Int,
    val createdAt: Long
)
