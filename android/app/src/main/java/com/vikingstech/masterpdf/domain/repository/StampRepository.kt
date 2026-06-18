package com.vikingstech.masterpdf.domain.repository

import com.vikingstech.masterpdf.domain.model.Stamp
import kotlinx.coroutines.flow.Flow

interface StampRepository {
    fun observeStamps(): Flow<List<Stamp>>
    suspend fun add(stamp: Stamp)
    suspend fun delete(id: Long)
}
