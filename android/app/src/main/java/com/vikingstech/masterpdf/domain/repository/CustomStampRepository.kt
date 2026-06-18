package com.vikingstech.masterpdf.domain.repository

import com.vikingstech.masterpdf.domain.model.CustomStamp
import kotlinx.coroutines.flow.Flow

interface CustomStampRepository {
    fun observeStamps(): Flow<List<CustomStamp>>
    suspend fun getById(id: String): CustomStamp?
    suspend fun save(stamp: CustomStamp)
    suspend fun delete(id: String)
}
