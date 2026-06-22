package com.vikingstech.masterpdf.data.image

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import java.io.File

/** Raster output formats supported by the image tools. */
enum class ImageFormat(val mime: String, val extension: String) {
    JPEG("image/jpeg", "jpg"),
    PNG("image/png", "png")
}

/**
 * Bitmap re-encoding for the image tools (compress / convert). Decodes the source
 * file, optionally flattens transparency for JPEG (which has no alpha channel),
 * and writes the target format at the requested quality.
 */
object ImageEngine {

    fun reencode(source: File, destination: File, format: ImageFormat, quality: Int) {
        val decoded = BitmapFactory.decodeFile(source.absolutePath)
            ?: error("That image could not be read")
        val bitmap = if (format == ImageFormat.JPEG && decoded.hasAlpha()) {
            flattenOnWhite(decoded).also { if (it != decoded) decoded.recycle() }
        } else {
            decoded
        }
        try {
            destination.outputStream().buffered().use { os ->
                val compress = when (format) {
                    ImageFormat.JPEG -> Bitmap.CompressFormat.JPEG
                    ImageFormat.PNG -> Bitmap.CompressFormat.PNG
                }
                bitmap.compress(compress, quality.coerceIn(1, 100), os)
            }
        } finally {
            bitmap.recycle()
        }
    }

    private fun flattenOnWhite(src: Bitmap): Bitmap {
        val out = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
        Canvas(out).apply {
            drawColor(Color.WHITE)
            drawBitmap(src, 0f, 0f, null)
        }
        return out
    }
}
