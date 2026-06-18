package com.vikingstech.masterpdf.data.repository

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import com.vikingstech.masterpdf.data.pdf.FormFieldExtractor
import com.vikingstech.masterpdf.data.pdf.PdfBoxManipulator
import com.vikingstech.masterpdf.data.pdf.PdfRendererViewport
import com.vikingstech.masterpdf.data.pdf.TextExtractor
import com.vikingstech.masterpdf.di.IoDispatcher
import com.vikingstech.masterpdf.domain.model.InkAnnotation
import com.vikingstech.masterpdf.domain.model.PdfDocument
import com.vikingstech.masterpdf.domain.model.PdfFormField
import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import com.vikingstech.masterpdf.domain.repository.DocumentRepository
import com.vikingstech.masterpdf.domain.util.Resource
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.abs

@Singleton
class DocumentRepositoryImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    @IoDispatcher private val io: CoroutineDispatcher
) : DocumentRepository {

    /** Live state for one open document. [viewport]/[workingFile] mutate on edit. */
    private class OpenDoc(
        val id: String,
        val uri: Uri,
        viewport: PdfRendererViewport,
        workingFile: File?
    ) {
        @Volatile var viewport: PdfRendererViewport = viewport
        @Volatile var workingFile: File? = workingFile
    }

    private val open = ConcurrentHashMap<String, OpenDoc>()

    override suspend fun openDocument(uri: String): Resource<PdfDocument> = withContext(io) {
        runCatching {
            val parsed = Uri.parse(uri)
            val pfd = openDescriptor(parsed) ?: error("Unable to open document descriptor")
            val viewport = PdfRendererViewport(pfd)
            val (name, size) = queryNameAndSize(parsed)
            open.remove(uri)?.let { it.viewport.close(); it.workingFile?.delete() }
            open[uri] = OpenDoc(uri, parsed, viewport, null)
            Resource.Success(
                PdfDocument(
                    id = uri,
                    uri = uri,
                    name = name,
                    pageCount = viewport.pageCount,
                    sizeBytes = size
                )
            )
        }.getOrElse { Resource.Error(it.message ?: "Could not open document", it) }
    }

    override suspend fun getPageInfo(documentId: String): List<PdfPageInfo> = withContext(io) {
        open[documentId]?.viewport?.pageInfos().orEmpty()
    }

    override suspend fun renderPage(
        documentId: String,
        pageIndex: Int,
        targetWidthPx: Int
    ): Resource<Bitmap> = withContext(io) {
        val vp = open[documentId]?.viewport
            ?: return@withContext Resource.Error("Document is not open")
        runCatching { Resource.Success(vp.renderPage(pageIndex, targetWidthPx)) }
            .getOrElse { Resource.Error(it.message ?: "Render failed", it) }
    }

    override suspend fun extractText(documentId: String, pageIndex: Int): Resource<String> =
        withContext(io) {
            val doc = open[documentId] ?: return@withContext Resource.Error("Document is not open")
            runCatching { Resource.Success(TextExtractor.extractPage(ensureWorkingFile(doc), pageIndex)) }
                .getOrElse { Resource.Error(it.message ?: "Text extraction failed", it) }
        }

    override suspend fun reorderPages(documentId: String, newOrder: List<Int>): Resource<Unit> =
        mutate(documentId) { src, dst -> PdfBoxManipulator.reorderPages(src, dst, newOrder) }

    override suspend fun deletePages(documentId: String, pageIndices: List<Int>): Resource<Unit> =
        mutate(documentId) { src, dst -> PdfBoxManipulator.deletePages(src, dst, pageIndices) }

    override suspend fun rotatePages(
        documentId: String,
        pageIndices: List<Int>,
        degrees: Int
    ): Resource<Unit> =
        mutate(documentId) { src, dst -> PdfBoxManipulator.rotatePages(src, dst, pageIndices, degrees) }

    override suspend fun save(documentId: String, destinationUri: String): Resource<String> =
        withContext(io) {
            val doc = open[documentId] ?: return@withContext Resource.Error("Document is not open")
            runCatching {
                val out = context.contentResolver.openOutputStream(Uri.parse(destinationUri))
                    ?: error("Cannot open destination for writing")
                out.use { os ->
                    val wf = doc.workingFile
                    if (wf != null) {
                        wf.inputStream().use { it.copyTo(os) }
                    } else {
                        context.contentResolver.openInputStream(doc.uri)
                            ?.use { it.copyTo(os) } ?: error("Cannot read source document")
                    }
                }
                Resource.Success(destinationUri)
            }.getOrElse { Resource.Error(it.message ?: "Save failed", it) }
        }

    override suspend fun addInkAnnotation(documentId: String, annotation: InkAnnotation): Resource<Unit> =
        mutate(documentId) { src, dst -> PdfBoxManipulator.addInkAnnotation(src, dst, annotation) }

    override suspend fun getFormFields(documentId: String): Resource<List<PdfFormField>> =
        withContext(io) {
            val doc = open[documentId] ?: return@withContext Resource.Error("Document is not open")
            runCatching {
                val fields = FormFieldExtractor.extractFields(ensureWorkingFile(doc))
                Resource.Success(fields)
            }.getOrElse { Resource.Error(it.message ?: "Form extraction failed", it) }
        }

    override suspend fun fillFormField(documentId: String, fieldName: String, value: String): Resource<Unit> =
        mutate(documentId) { src, dst -> PdfBoxManipulator.fillFormField(src, dst, fieldName, value) }

    override fun close(documentId: String) {
        open.remove(documentId)?.let { doc ->
            doc.viewport.close()
            doc.workingFile?.delete()
        }
    }

    // ── internals ──────────────────────────────────────────────────────────

    /** Run a PdfBox edit src→dst, then hot-swap the viewport to the new file. */
    private suspend fun mutate(
        documentId: String,
        edit: (src: File, dst: File) -> Unit
    ): Resource<Unit> = withContext(io) {
        val doc = open[documentId] ?: return@withContext Resource.Error("Document is not open")
        runCatching {
            val src = ensureWorkingFile(doc)
            val dst = File(context.cacheDir, "edit_${System.nanoTime()}.pdf")
            edit(src, dst)
            doc.viewport.close()
            doc.viewport = PdfRendererViewport(
                ParcelFileDescriptor.open(dst, ParcelFileDescriptor.MODE_READ_ONLY)
            )
            if (src != dst) src.delete()
            doc.workingFile = dst
            Resource.Success(Unit)
        }.getOrElse { Resource.Error(it.message ?: "Edit failed", it) }
    }

    /** Materialise the source into a private cache file PdfBox can read/write. */
    private fun ensureWorkingFile(doc: OpenDoc): File {
        doc.workingFile?.let { return it }
        val file = File(context.cacheDir, "work_${abs(doc.id.hashCode())}.pdf")
        context.contentResolver.openInputStream(doc.uri)?.use { input ->
            file.outputStream().use { input.copyTo(it) }
        } ?: error("Cannot read source document")
        doc.workingFile = file
        return file
    }

    private fun openDescriptor(uri: Uri): ParcelFileDescriptor? = when (uri.scheme) {
        null, "file" -> ParcelFileDescriptor.open(
            File(requireNotNull(uri.path)), ParcelFileDescriptor.MODE_READ_ONLY
        )
        else -> context.contentResolver.openFileDescriptor(uri, "r")
    }

    private fun queryNameAndSize(uri: Uri): Pair<String, Long> {
        var name = uri.lastPathSegment ?: "document.pdf"
        var size = 0L
        when (uri.scheme) {
            "content" -> context.contentResolver.query(uri, null, null, null, null)?.use { c ->
                val nameIdx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIdx = c.getColumnIndex(OpenableColumns.SIZE)
                if (c.moveToFirst()) {
                    if (nameIdx >= 0) c.getString(nameIdx)?.let { name = it }
                    if (sizeIdx >= 0 && !c.isNull(sizeIdx)) size = c.getLong(sizeIdx)
                }
            }
            null, "file" -> File(uri.path ?: "").takeIf { it.exists() }?.let {
                name = it.name
                size = it.length()
            }
        }
        return name to size
    }
}
