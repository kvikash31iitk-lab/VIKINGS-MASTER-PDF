package com.vikingstech.masterpdf.data.network.api

import com.vikingstech.masterpdf.data.network.dto.ChatRequestDto
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.HeaderMap
import retrofit2.http.POST
import retrofit2.http.Streaming
import retrofit2.http.Url

interface AiApi {
    /**
     * Streams a chat completion. [url] is absolute (taken from user settings) so
     * the Retrofit base URL is only a placeholder. [Streaming] keeps the body as
     * a live socket the handler reads line-by-line instead of buffering it all.
     */
    @Streaming
    @POST
    suspend fun streamChat(
        @Url url: String,
        @HeaderMap headers: Map<String, String>,
        @Body body: ChatRequestDto
    ): Response<ResponseBody>
}
