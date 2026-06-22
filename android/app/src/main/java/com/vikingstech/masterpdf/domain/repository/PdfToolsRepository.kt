package com.vikingstech.masterpdf.domain.repository

import com.vikingstech.masterpdf.domain.model.ImageOutputFormat
import com.vikingstech.masterpdf.domain.model.OfficeFormat
import com.vikingstech.masterpdf.domain.model.PageNumberPlacement
import com.vikingstech.masterpdf.domain.util.Resource

/**
 * Stateless, URI→URI operations powering the standalone Tools hub. Unlike
 * [DocumentRepository] (which owns an open-document lifecycle for the viewer),
 * every method here takes source content URIs and a destination content URI,
 * does its work against private temp files, and streams the result back out — so
 * the hub tools never need a pre-opened document.
 *
 * Conversions return the destination URI on success; [extractText]/[ocr] return
 * the recognised text for display.
 */
interface PdfToolsRepository {

    suspend fun merge(sources: List<String>, destination: String): Resource<String>

    suspend fun split(source: String, ranges: String, destination: String): Resource<String>

    suspend fun compress(source: String, quality: Float, destination: String): Resource<String>

    suspend fun rotateAll(source: String, degrees: Int, destination: String): Resource<String>

    suspend fun imagesToPdf(images: List<String>, destination: String): Resource<String>

    /** Render every page to an image and bundle them into a single .zip. */
    suspend fun pdfToImages(source: String, png: Boolean, quality: Int, destination: String): Resource<String>

    suspend fun addPageNumbers(
        source: String,
        placement: PageNumberPlacement,
        startAt: Int,
        fontSize: Float,
        destination: String
    ): Resource<String>

    suspend fun addWatermark(
        source: String,
        text: String,
        opacity: Float,
        rotation: Float,
        fontSize: Float,
        destination: String
    ): Resource<String>

    suspend fun protect(source: String, password: String, destination: String): Resource<String>

    suspend fun unlock(source: String, password: String, destination: String): Resource<String>

    suspend fun repair(source: String, destination: String): Resource<String>

    suspend fun createPdfFromText(text: String, destination: String): Resource<String>

    suspend fun pdfToWord(source: String, destination: String): Resource<String>

    suspend fun pdfToExcel(source: String, destination: String): Resource<String>

    /** Export each page as an image, packaged as a .zip (slide-image package). */
    suspend fun pdfToPowerpoint(source: String, destination: String): Resource<String>

    suspend fun officeToPdf(source: String, format: OfficeFormat, destination: String): Resource<String>

    suspend fun extractText(source: String): Resource<String>

    suspend fun ocr(source: String): Resource<String>

    suspend fun compressImage(source: String, quality: Int, destination: String): Resource<String>

    suspend fun convertImage(source: String, format: ImageOutputFormat, destination: String): Resource<String>

    /** Write recognised/extracted [text] out to a destination .txt URI. */
    suspend fun saveText(text: String, destination: String): Resource<String>
}
