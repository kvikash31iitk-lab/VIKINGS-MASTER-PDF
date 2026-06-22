package com.vikingstech.masterpdf.data.image

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import java.io.File

/**
 * Safe bitmap loading for the image tools:
 *  - downsamples very large images (inSampleSize) so a 50 MP photo can't OOM,
 *  - applies the JPEG EXIF orientation so portrait photos aren't saved sideways.
 *
 * Uses the platform [android.media.ExifInterface] (file-path based) so no extra
 * dependency is needed; non-JPEG inputs simply report a normal orientation.
 */
object ImageDecoder {

    private const val MAX_DIMENSION = 3000

    fun load(file: File, maxDimension: Int = MAX_DIMENSION): Bitmap {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        require(bounds.outWidth > 0 && bounds.outHeight > 0) { "That image could not be read" }

        val opts = BitmapFactory.Options().apply {
            inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight, maxDimension)
        }
        val decoded = BitmapFactory.decodeFile(file.absolutePath, opts)
            ?: error("That image could not be read")
        return applyExifOrientation(file, decoded)
    }

    private fun sampleSize(width: Int, height: Int, maxDim: Int): Int {
        var sample = 1
        while (width / sample > maxDim || height / sample > maxDim) sample *= 2
        return sample
    }

    private fun applyExifOrientation(file: File, bitmap: Bitmap): Bitmap {
        val orientation = runCatching {
            ExifInterface(file.absolutePath)
                .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)

        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> { matrix.postRotate(90f); matrix.postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_TRANSVERSE -> { matrix.postRotate(270f); matrix.postScale(-1f, 1f) }
            else -> return bitmap
        }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        if (rotated != bitmap) bitmap.recycle()
        return rotated
    }
}
