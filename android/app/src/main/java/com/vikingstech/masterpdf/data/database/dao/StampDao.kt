package com.vikingstech.masterpdf.data.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.vikingstech.masterpdf.data.database.entity.StampEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface StampDao {
    @Query("SELECT * FROM stamps ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<StampEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: StampEntity): Long

    @Query("DELETE FROM stamps WHERE id = :id")
    suspend fun delete(id: Long)
}
