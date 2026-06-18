package com.vikingstech.masterpdf.data.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
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
    version = 2,
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

        /**
         * v1 → v2: adds the recents thumbnail column. The custom_stamps table was
         * already part of the v1 entity set, so it is intentionally not (re)created
         * here — only the new column is introduced.
         */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE recents ADD COLUMN thumbnailUri TEXT")
            }
        }
    }
}
