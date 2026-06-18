package com.vikingstech.masterpdf.data.repository

import android.content.Context
import com.vikingstech.masterpdf.data.database.dao.SignatureDao
import com.vikingstech.masterpdf.data.database.entity.SignatureEntity
import com.vikingstech.masterpdf.data.database.mapper.toDomain
import com.vikingstech.masterpdf.di.IoDispatcher
import com.vikingstech.masterpdf.domain.model.Signature
import com.vikingstech.masterpdf.domain.repository.SignatureRepository
import com.vikingstech.masterpdf.domain.util.Resource
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SignatureRepositoryImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val signatureDao: SignatureDao,
    @IoDispatcher private val io: CoroutineDispatcher
) : SignatureRepository {

    override fun observeSignatures(): Flow<List<Signature>> =
        signatureDao.observeAll().map { rows -> rows.map { it.toDomain() } }

    override suspend fun add(name: String, pngBytes: ByteArray): Resource<Signature> =
        withContext(io) {
            runCatching {
                val dir = File(context.filesDir, "signatures").apply { mkdirs() }
                val file = File(dir, "sig_${System.nanoTime()}.png")
                file.writeBytes(pngBytes)
                val now = System.currentTimeMillis()
                val id = signatureDao.insert(
                    SignatureEntity(name = name, pngPath = file.absolutePath, createdAt = now)
                )
                Resource.Success(
                    Signature(id = id, name = name, pngPath = file.absolutePath, createdAt = now)
                )
            }.getOrElse { Resource.Error(it.message ?: "Could not save signature", it) }
        }

    // Note: leaves the backing PNG on disk; a later cleanup pass can prune
    // orphans. Kept simple here so deletion never blocks on file I/O.
    override suspend fun delete(id: Long) = signatureDao.delete(id)
}
