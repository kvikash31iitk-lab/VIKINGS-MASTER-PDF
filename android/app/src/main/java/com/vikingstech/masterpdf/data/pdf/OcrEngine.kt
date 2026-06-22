package com.vikingstech.masterpdf.data.pdf

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File

/**
 * On-device OCR via ML Kit text recognition. Each PDF page is rasterised with the
 * platform [PdfRenderer] then fed to the recognizer; the recognised text is
 * concatenated page-by-page. Runs blocking ([Tasks.await]) so the caller must
 * invoke it on an IO dispatcher.
 *
 * Note: this yields the recognised *text*; producing a fully searchable PDF
 * (an invisible text layer aligned over the original raster) is a larger task and
 * is documented as a limitation.
 */
object OcrEngine {

    fun recognize(source: File, targetWidth: Int = 1654): String {
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val sb = StringBuilder()
        try {
            ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
                PdfRenderer(pfd).use { renderer ->
                    for (i in 0 until renderer.pageCount) {
                        val bmp = renderPage(renderer, i, targetWidth)
                        val result = Tasks.await(recognizer.process(InputImage.fromBitmap(bmp, 0)))
                        val text = result.text
                        if (text.isNotBlank()) {
                            sb.append("— Page ${i + 1} —\n").append(text).append("\n\n")
                        }
                        bmp.recycle()
                    }
                }
            }
        } finally {
            recognizer.close()
        }
        return sb.toString().trim()
    }

    private fun renderPage(renderer: PdfRenderer, index: Int, targetWidth: Int): Bitmap {
        renderer.openPage(index).use { page ->
            val aspect = if (page.width == 0) 1f else page.height.toFloat() / page.width
            val w = targetWidth
            val h = (targetWidth * aspect).toInt().coerceAtLeast(1)
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            bmp.eraseColor(Color.WHITE)
            page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)
            return bmp
        }
    }
}
