package com.vikingstech.masterpdf.domain.usecase

import com.vikingstech.masterpdf.domain.model.ChatMessage
import com.vikingstech.masterpdf.domain.repository.AiRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class StreamAiResponseUseCase @Inject constructor(
    private val aiRepository: AiRepository
) {
    operator fun invoke(messages: List<ChatMessage>): Flow<String> =
        aiRepository.streamChat(messages)
}
