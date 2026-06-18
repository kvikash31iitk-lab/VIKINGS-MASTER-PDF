package com.vikingstech.masterpdf.data.network

import com.google.gson.Gson
import javax.inject.Inject

/**
 * Parses one Server-Sent-Events line from a streaming chat completion and
 * returns the incremental text delta, or null for keep-alives / the terminator.
 */
class AiStreamHandler @Inject constructor(
    private val gson: Gson
) {
    fun parseSseLine(line: String): String? {
        if (!line.startsWith(DATA_PREFIX)) return null
        val payload = line.removePrefix(DATA_PREFIX).trim()
        if (payload.isEmpty() || payload == DONE) return null
        return runCatching {
            gson.fromJson(payload, StreamChunk::class.java)
                .choices
                ?.firstOrNull()
                ?.delta
                ?.content
        }.getOrNull()
    }

    private data class StreamChunk(val choices: List<Choice>?)
    private data class Choice(val delta: Delta?)
    private data class Delta(val content: String?)

    private companion object {
        const val DATA_PREFIX = "data:"
        const val DONE = "[DONE]"
    }
}
