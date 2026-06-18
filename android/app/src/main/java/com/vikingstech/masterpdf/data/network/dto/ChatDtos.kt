package com.vikingstech.masterpdf.data.network.dto

/**
 * Request body for an OpenAI-compatible streaming chat completion — the de-facto
 * format accepted by most self-hosted gateways and proxies the user may point at.
 */
data class ChatRequestDto(
    val model: String,
    val messages: List<ChatMessageDto>,
    val stream: Boolean = true
)

data class ChatMessageDto(
    val role: String,
    val content: String
)
