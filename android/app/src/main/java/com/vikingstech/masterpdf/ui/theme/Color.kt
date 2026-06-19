package com.vikingstech.masterpdf.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

// ── Brand palette (Vikings blue and navy theme) ──
val VikingBlue = Color(0xFF2563EB)
val VikingBlueLight = Color(0xFF3B82F6)
val VikingNavy = Color(0xFF091428)
val VikingNavyLight = Color(0xFF0F1E36)
val VikingAmber = Color(0xFFD97706)
val VikingRed = Color(0xFFEF4444)
val VikingGreen = Color(0xFF10B981)

val LightColors = lightColorScheme(
    primary = VikingBlue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFEFF6FF),
    onPrimaryContainer = Color(0xFF1E3A8A),
    secondary = Color(0xFF475569),
    onSecondary = Color.White,
    background = Color(0xFFF8FAFC),
    onBackground = Color(0xFF0F172A),
    surface = Color.White,
    onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF475569),
    error = VikingRed,
    onError = Color.White,
    outline = Color(0xFFE2E8F0),
    outlineVariant = Color(0xFFCBD5E1)
)

val DarkColors = darkColorScheme(
    primary = VikingBlueLight,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF1E3A8A),
    onPrimaryContainer = Color(0xFFEFF6FF),
    secondary = Color(0xFF94A3B8),
    onSecondary = Color(0xFF0F172A),
    background = VikingNavy,
    onBackground = Color(0xFFF1F5F9),
    surface = VikingNavyLight,
    onSurface = Color(0xFFF8FAFC),
    surfaceVariant = Color(0xFF1E293B),
    onSurfaceVariant = Color(0xFF94A3B8),
    error = Color(0xFFF87171),
    onError = Color(0xFF7F1D1D),
    outline = Color(0xFF334155),
    outlineVariant = Color(0xFF475569)
)

// True-black variant for OLED displays (battery + contrast).
val OledDarkColors = DarkColors.copy(
    background = Color.Black,
    surface = Color.Black,
    surfaceVariant = Color(0xFF0F0F0F),
    outline = Color(0xFF1E293B)
)
