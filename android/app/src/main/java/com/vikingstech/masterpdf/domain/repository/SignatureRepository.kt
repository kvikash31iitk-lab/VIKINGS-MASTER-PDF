package com.vikingstech.masterpdf.domain.repository

import com.vikingstech.masterpdf.domain.model.Signature
import com.vikingstech.masterpdf.domain.util.Resource
import kotlinx.coroutines.flow.Flow

interface SignatureRepository {
    fun observeSignatures(): Flow<List<Signature>>
    suspend fun add(name: String, pngBytes: ByteArray): Resource<Signature>
    suspend fun delete(id: Long)
}
