package com.vikingstech.masterpdf.data.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Single-row settings table (id is always 0). */
@Entity(tableName = "settings")
data class SettingsEntity(
    @PrimaryKey val id: Int = 0,
    val themeMode: String = "SYSTEM",
    val oledDarkMode: Boolean = false,
    val dynamicColor: Boolean = true,
    val defaultZoom: Float = 1f,
    val aiBaseUrl: String = "",
    val aiApiKey: String = "",
    val aiModel: String = "claude-sonnet-4-6"
)
