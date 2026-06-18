package com.vikingstech.masterpdf.di

import android.content.Context
import androidx.room.Room
import com.vikingstech.masterpdf.data.database.MasterPdfDatabase
import com.vikingstech.masterpdf.data.database.dao.BookmarkDao
import com.vikingstech.masterpdf.data.database.dao.RecentDao
import com.vikingstech.masterpdf.data.database.dao.SettingsDao
import com.vikingstech.masterpdf.data.database.dao.SignatureDao
import com.vikingstech.masterpdf.data.database.dao.StampDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): MasterPdfDatabase =
        Room.databaseBuilder(context, MasterPdfDatabase::class.java, MasterPdfDatabase.NAME)
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideRecentDao(db: MasterPdfDatabase): RecentDao = db.recentDao()
    @Provides fun provideSettingsDao(db: MasterPdfDatabase): SettingsDao = db.settingsDao()
    @Provides fun provideStampDao(db: MasterPdfDatabase): StampDao = db.stampDao()
    @Provides fun provideSignatureDao(db: MasterPdfDatabase): SignatureDao = db.signatureDao()
    @Provides fun provideBookmarkDao(db: MasterPdfDatabase): BookmarkDao = db.bookmarkDao()
}
