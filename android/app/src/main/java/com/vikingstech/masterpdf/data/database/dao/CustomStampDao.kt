package com.vikingstech.masterpdf.data.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.vikingstech.masterpdf.data.database.entity.CustomStampEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CustomStampDao {
    @Query("SELECT * FROM custom_stamps ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<CustomStampEntity>>

    @Query("SELECT * FROM custom_stamps WHERE id = :id")
    suspend fun getById(id: String): CustomStampEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: CustomStampEntity)

    @Query("DELETE FROM custom_stamps WHERE id = :id")
    suspend fun delete(id: String)
}
