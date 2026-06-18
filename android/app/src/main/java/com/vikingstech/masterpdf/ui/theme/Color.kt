package com.vikingstech.masterpdf.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

// ── Brand palette (Vikings blue) ──
val VikingBlue = Color(0xFF2563EB)
val VikingBlueLight = Color(0xFF3B82F6)
val VikingNavy = Color(0xFF0B1B3A)
val VikingAmber = Color(0xFFB45309)
val VikingRed = Color(0xFFD13438)
val VikingGreen = Color(0xFF107C10)

val LightColors = lightColorScheme(
    primary = VikingBlue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDCE6FD),
    onPrimaryContainer = Color(0xFF0B1B3A),
    secondary = Color(0xFF5A6271),
    background = Color(0xFFF3F4F6),
    onBackground = Color(0xFF1B1F27),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1B1F27),
    surfaceVariant = Color(0xFFEEF0F4),
    onSurfaceVariant = Color(0xFF5A6271),
    error = VikingRed,
    outline = Color(0xFFC9CDD6)
)

val DarkColors = darkColorScheme(
    primary = VikingBlueLight,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF1F3057),
    onPrimaryContainer = Color(0xFFDCE6FD),
    secondary = Color(0xFF9AA2B2),
    background = Color(0xFF16181D),
    onBackground = Color(0xFFE8EAF0),
    surface = Color(0xFF1F2229),
    onSurface = Color(0xFFE8EAF0),
    surfaceVariant = Color(0xFF2D323D),
    onSurfaceVariant = Color(0xFF9AA2B2),
    error = Color(0xFFF1707A),
    outline = Color(0xFF454C5B)
)

// True-black variant for OLED displays (battery + contrast).
val OledDarkColors = DarkColors.copy(
    background = Color.Black,
    surface = Color.Black,
    surfaceVariant = Color(0xFF0F0F0F)
)
