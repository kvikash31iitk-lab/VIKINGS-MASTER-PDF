package com.vikingstech.masterpdf.data.database

import androidx.room.Database
import androidx.room.RoomDatabase
import com.vikingstech.masterpdf.data.database.dao.BookmarkDao
import com.vikingstech.masterpdf.data.database.dao.CustomStampDao
import com.vikingstech.masterpdf.data.database.dao.RecentDao
import com.vikingstech.masterpdf.data.database.dao.SettingsDao
import com.vikingstech.masterpdf.data.database.dao.SignatureDao
import com.vikingstech.masterpdf.data.database.dao.StampDao
import com.vikingstech.masterpdf.data.database.entity.BookmarkEntity
import com.vikingstech.masterpdf.data.database.entity.CustomStampEntity
import com.vikingstech.masterpdf.data.database.entity.RecentEntity
import com.vikingstech.masterpdf.data.database.entity.SettingsEntity
import com.vikingstech.masterpdf.data.database.entity.SignatureEntity
import com.vikingstech.masterpdf.data.database.entity.StampEntity

@Database(
    entities = [
        RecentEntity::class,
        SettingsEntity::class,
        StampEntity::class,
        SignatureEntity::class,
        BookmarkEntity::class,
        CustomStampEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class MasterPdfDatabase : RoomDatabase() {
    abstract fun recentDao(): RecentDao
    abstract fun settingsDao(): SettingsDao
    abstract fun stampDao(): StampDao
    abstract fun signatureDao(): SignatureDao
    abstract fun bookmarkDao(): BookmarkDao
    abstract fun customStampDao(): CustomStampDao

    companion object {
        const val NAME = "vikings_master_pdf.db"
    }
}
