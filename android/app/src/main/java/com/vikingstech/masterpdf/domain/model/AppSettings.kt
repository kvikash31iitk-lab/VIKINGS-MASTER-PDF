package com.vikingstech.masterpdf.domain.model

data class AppSettings(
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val oledDarkMode: Boolean = false,
    val dynamicColor: Boolean = true,
    val defaultZoom: Float = 1f,
    val aiBaseUrl: String = "",
    val aiApiKey: String = "",
    val aiModel: String = "claude-sonnet-4-6"
)

enum class ThemeMode { LIGHT, DARK, SYSTEM }
