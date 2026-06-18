package com.vikingstech.masterpdf.domain.model

import androidx.compose.ui.graphics.Color

data class CustomStamp(
    val id: String = "",
    val name: String,
    val text: String,
    val textColor: Color = Color.Black,
    val backgroundColor: Color = Color.White,
    val borderColor: Color = Color.Black,
    val borderWidth: Float = 1f,
    val fontSize: Float = 12f,
    val borderRadius: Float = 4f,
    val createdAt: Long = System.currentTimeMillis()
)

data class StampPlacement(
    val stampId: String,
    val pageIndex: Int,
    val x: Float,
    val y: Float,
    val width: Float = 80f,
    val height: Float = 40f,
    val rotation: Float = 0f
)
