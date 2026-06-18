package com.vikingstech.masterpdf.di

import com.vikingstech.masterpdf.data.repository.AiRepositoryImpl
import com.vikingstech.masterpdf.data.repository.BookmarkRepositoryImpl
import com.vikingstech.masterpdf.data.repository.CustomStampRepositoryImpl
import com.vikingstech.masterpdf.data.repository.DocumentRepositoryImpl
import com.vikingstech.masterpdf.data.repository.RecentsRepositoryImpl
import com.vikingstech.masterpdf.data.repository.SettingsRepositoryImpl
import com.vikingstech.masterpdf.data.repository.SignatureRepositoryImpl
import com.vikingstech.masterpdf.data.repository.StampRepositoryImpl
import com.vikingstech.masterpdf.domain.repository.AiRepository
import com.vikingstech.masterpdf.domain.repository.BookmarkRepository
import com.vikingstech.masterpdf.domain.repository.CustomStampRepository
import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.repository.RecentsRepository
import com.vikingstech.masterpdf.domain.repository.SettingsRepository
import com.vikingstech.masterpdf.domain.repository.SignatureRepository
import com.vikingstech.masterpdf.domain.repository.StampRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds @Singleton
    abstract fun bindDocumentRepository(impl: DocumentRepositoryImpl): DocumentRepository

    @Binds @Singleton
    abstract fun bindRecentsRepository(impl: RecentsRepositoryImpl): RecentsRepository

    @Binds @Singleton
    abstract fun bindSettingsRepository(impl: SettingsRepositoryImpl): SettingsRepository

    @Binds @Singleton
    abstract fun bindSignatureRepository(impl: SignatureRepositoryImpl): SignatureRepository

    @Binds @Singleton
    abstract fun bindStampRepository(impl: StampRepositoryImpl): StampRepository

    @Binds @Singleton
    abstract fun bindCustomStampRepository(impl: CustomStampRepositoryImpl): CustomStampRepository

    @Binds @Singleton
    abstract fun bindBookmarkRepository(impl: BookmarkRepositoryImpl): BookmarkRepository

    @Binds @Singleton
    abstract fun bindAiRepository(impl: AiRepositoryImpl): AiRepository
}
