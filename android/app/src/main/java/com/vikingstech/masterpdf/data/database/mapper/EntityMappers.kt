package com.vikingstech.masterpdf.data.database.mapper

import androidx.compose.ui.graphics.Color
import com.vikingstech.masterpdf.data.database.entity.BookmarkEntity
import com.vikingstech.masterpdf.data.database.entity.CustomStampEntity
import com.vikingstech.masterpdf.data.database.entity.RecentEntity
import com.vikingstech.masterpdf.data.database.entity.SettingsEntity
import com.vikingstech.masterpdf.data.database.entity.SignatureEntity
import com.vikingstech.masterpdf.data.database.entity.StampEntity
import com.vikingstech.masterpdf.domain.model.AppSettings
import com.vikingstech.masterpdf.domain.model.Bookmark
import com.vikingstech.masterpdf.domain.model.CustomStamp
import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.domain.model.Signature
import com.vikingstech.masterpdf.domain.model.Stamp
import com.vikingstech.masterpdf.domain.model.StampType
import com.vikingstech.masterpdf.domain.model.ThemeMode
import java.util.UUID

// ── Recents ──
fun RecentEntity.toDomain() = RecentDocument(
    uri = uri,
    name = name,
    pageCount = pageCount,
    sizeBytes = sizeBytes,
    lastPageIndex = lastPageIndex,
    lastOpenedAt = lastOpenedAt,
    isPinned = isPinned
)

// ── Settings ── (defensive enum parsing so a bad row can't crash startup)
fun SettingsEntity.toDomain() = AppSettings(
    themeMode = runCatching { ThemeMode.valueOf(themeMode) }.getOrDefault(ThemeMode.SYSTEM),
    oledDarkMode = oledDarkMode,
    dynamicColor = dynamicColor,
    defaultZoom = defaultZoom,
    aiBaseUrl = aiBaseUrl,
    aiApiKey = aiApiKey,
    aiModel = aiModel
)

fun AppSettings.toEntity() = SettingsEntity(
    id = 0,
    themeMode = themeMode.name,
    oledDarkMode = oledDarkMode,
    dynamicColor = dynamicColor,
    defaultZoom = defaultZoom,
    aiBaseUrl = aiBaseUrl,
    aiApiKey = aiApiKey,
    aiModel = aiModel
)

// ── Stamps ──
fun StampEntity.toDomain() = Stamp(
    id = id,
    label = label,
    type = runCatching { StampType.valueOf(type) }.getOrDefault(StampType.CUSTOM),
    colorArgb = colorArgb,
    createdAt = createdAt
)

fun Stamp.toEntity() = StampEntity(
    id = id,
    label = label,
    type = type.name,
    colorArgb = colorArgb,
    createdAt = createdAt
)

// ── Signatures ──
fun SignatureEntity.toDomain() = Signature(
    id = id,
    name = name,
    pngPath = pngPath,
    createdAt = createdAt
)

// ── Bookmarks ──
fun BookmarkEntity.toDomain() = Bookmark(
    id = id,
    documentId = documentId,
    pageIndex = pageIndex,
    label = label,
    createdAt = createdAt
)

fun Bookmark.toEntity() = BookmarkEntity(
    id = id,
    documentId = documentId,
    pageIndex = pageIndex,
    label = label,
    createdAt = createdAt
)

// ── Custom Stamps ──
fun CustomStampEntity.toDomain() = CustomStamp(
    id = id,
    name = name,
    text = text,
    textColor = Color(textColor),
    backgroundColor = Color(backgroundColor),
    borderColor = Color(borderColor),
    borderWidth = borderWidth,
    fontSize = fontSize,
    borderRadius = borderRadius,
    createdAt = createdAt
)

fun CustomStamp.toEntity() = CustomStampEntity(
    id = id.ifEmpty { UUID.randomUUID().toString() },
    name = name,
    text = text,
    textColor = textColor.value.toLong(),
    backgroundColor = backgroundColor.value.toLong(),
    borderColor = borderColor.value.toLong(),
    borderWidth = borderWidth,
    fontSize = fontSize,
    borderRadius = borderRadius,
    createdAt = createdAt
)
