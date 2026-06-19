package com.vikingstech.masterpdf.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

// ── Brand palette (Vikings blue and navy theme) ──
val VikingBlue = Color(0xFF2563EB)
val VikingBlueLight = Color(0xFF3B82F6)
val VikingNavy = Color(0xFF091428)
val VikingNavyLight = Color(0xFF0F1F3C)
val VikingAmber = Color(0xFFD97706)
val VikingRed = Color(0xFFEF4444)
val VikingGreen = Color(0xFF10B981)

val LightColors = lightColorScheme(
    primary = VikingBlue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFEFF6FF),
    onPrimaryContainer = Color(0xFF1E3A8A),
    secondary = Color(0xFF52628B),
    onSecondary = Color.White,
    background = Color(0xFFEAF0F8),
    onBackground = Color(0xFF0B1B3A),
    surface = Color.White,
    onSurface = Color(0xFF0B1B3A),
    surfaceVariant = Color(0xFFFFFFFF),
    onSurfaceVariant = Color(0xFF52628B),
    error = VikingRed,
    onError = Color.White,
    outline = Color(0x1A0B1B3A),
    outlineVariant = Color(0x2E0B1B3A)
)

val DarkColors = darkColorScheme(
    primary = VikingBlue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF1E293B),
    onPrimaryContainer = Color(0xFFEEF3FC),
    secondary = Color(0xFFA7B8D6),
    onSecondary = Color(0xFF091428),
    background = VikingNavy,
    onBackground = Color(0xFFEEF3FC),
    surface = VikingNavyLight,
    onSurface = Color(0xFFEEF3FC),
    surfaceVariant = Color(0xFF16264A),
    onSurfaceVariant = Color(0xFFA7B8D6),
    error = Color(0xFFF87171),
    onError = Color(0xFF7F1D1D),
    outline = Color(0x17FFFFFF),
    outlineVariant = Color(0x29FFFFFF)
)


// True-black variant for OLED displays (battery + contrast).
val OledDarkColors = DarkColors.copy(
    background = Color.Black,
    surface = Color.Black,
    surfaceVariant = Color(0xFF0F0F0F),
    outline = Color(0xFF1E293B)
)
