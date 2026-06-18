package com.vikingstech.masterpdf.data.repository

import com.vikingstech.masterpdf.data.network.AiStreamHandler
import com.vikingstech.masterpdf.data.network.api.AiApi
import com.vikingstech.masterpdf.data.network.dto.ChatMessageDto
import com.vikingstech.masterpdf.data.network.dto.ChatRequestDto
import com.vikingstech.masterpdf.di.IoDispatcher
import com.vikingstech.masterpdf.domain.model.ChatMessage
import com.vikingstech.masterpdf.domain.repository.AiRepository
import com.vikingstech.masterpdf.domain.repository.SettingsRepository
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AiRepositoryImpl @Inject constructor(
    private val api: AiApi,
    private val streamHandler: AiStreamHandler,
    private val settingsRepository: SettingsRepository,
    @IoDispatcher private val io: CoroutineDispatcher
) : AiRepository {

    override fun streamChat(messages: List<ChatMessage>): Flow<String> = flow {
        val settings = settingsRepository.observeSettings().first()
        require(settings.aiBaseUrl.isNotBlank()) { "AI endpoint is not configured in Settings" }

        val request = ChatRequestDto(
            model = settings.aiModel,
            messages = messages.map { ChatMessageDto(it.role.name.lowercase(), it.content) }
        )
        val headers = buildMap {
            put("Content-Type", "application/json")
            put("Accept", "text/event-stream")
            if (settings.aiApiKey.isNotBlank()) put("Authorization", "Bearer ${settings.aiApiKey}")
        }

        val response = api.streamChat(settings.aiBaseUrl, headers, request)
        if (!response.isSuccessful) throw IOException("AI request failed (${response.code()})")
        val body = response.body() ?: throw IOException("Empty AI response body")

        body.byteStream().bufferedReader().use { reader ->
            reader.lineSequence().forEach { line ->
                streamHandler.parseSseLine(line)?.let { emit(it) }
            }
        }
    }.flowOn(io)
}
