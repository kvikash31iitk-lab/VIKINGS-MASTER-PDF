package com.vikingstech.masterpdf.data.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.vikingstech.masterpdf.data.database.entity.SignatureEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SignatureDao {
    @Query("SELECT * FROM signatures ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<SignatureEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: SignatureEntity): Long

    @Query("DELETE FROM signatures WHERE id = :id")
    suspend fun delete(id: Long)
}
