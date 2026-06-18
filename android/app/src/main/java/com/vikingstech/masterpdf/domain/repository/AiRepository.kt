package com.vikingstech.masterpdf.domain.repository

import com.vikingstech.masterpdf.domain.model.ChatMessage
import kotlinx.coroutines.flow.Flow

interface AiRepository {
    /** Emits assistant text deltas as they stream in for the given conversation. */
    fun streamChat(messages: List<ChatMessage>): Flow<String>
}
