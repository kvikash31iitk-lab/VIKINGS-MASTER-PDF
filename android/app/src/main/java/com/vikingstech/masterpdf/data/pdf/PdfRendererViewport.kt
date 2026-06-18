package com.vikingstech.masterpdf.data.pdf

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.util.LruCache
import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.math.sqrt

/**
 * Wraps the hardware-accelerated [android.graphics.pdf.PdfRenderer] for one
 * document. Designed for 500 MB / 1000+ page files without OOM:
 *
 *  - The renderer is backed by a seekable [ParcelFileDescriptor]; pages are
 *    decoded on demand, never the whole document.
 *  - PdfRenderer allows exactly one open page at a time and is not thread-safe,
 *    so every access is serialised through a coroutine [Mutex].
 *  - Rendered pages live in a byte-budgeted [LruCache]; old pages are evicted
 *    (and left to the GC — never force-recycled, since Compose may still hold a
 *    reference to a visible page).
 *  - Each bitmap is sized to the requested viewport width and hard-capped in
 *    total area, bounding peak memory regardless of page dimensions.
 */
class PdfRendererViewport(
    private val fileDescriptor: ParcelFileDescriptor,
    maxCacheBytes: Int = defaultCacheBudget()
) {
    private val renderer = PdfRenderer(fileDescriptor)
    private val mutex = Mutex()

    @Volatile private var closed = false

    val pageCount: Int get() = renderer.pageCount

    private val cache = object : LruCache<String, Bitmap>(maxCacheBytes) {
        override fun sizeOf(key: String, value: Bitmap): Int = value.allocationByteCount
    }

    /** Page geometry for every page; used to lay out placeholders up front. */
    suspend fun pageInfos(): List<PdfPageInfo> = mutex.withLock {
        if (closed) return emptyList()
        (0 until renderer.pageCount).map { i ->
            renderer.openPage(i).use { page ->
                PdfPageInfo(index = i, widthPx = page.width, heightPx = page.height)
            }
        }
    }

    /** Render [index] scaled to ~[targetWidthPx]; cached by (page, width). */
    suspend fun renderPage(index: Int, targetWidthPx: Int): Bitmap = mutex.withLock {
        check(!closed) { "Viewport is closed" }
        val safeWidth = targetWidthPx.coerceIn(MIN_WIDTH, MAX_WIDTH)
        val key = "$index@$safeWidth"
        cache.get(key)?.let { return@withLock it }

        renderer.openPage(index).use { page ->
            val aspect = if (page.width == 0) 1f else page.height.toFloat() / page.width.toFloat()
            var w = safeWidth
            var h = (safeWidth * aspect).toInt().coerceAtLeast(1)

            // Cap total area so a very tall/large page can't blow the heap.
            val area = w.toLong() * h.toLong()
            if (area > MAX_AREA) {
                val scale = sqrt(MAX_AREA.toDouble() / area.toDouble()).toFloat()
                w = (w * scale).toInt().coerceAtLeast(1)
                h = (h * scale).toInt().coerceAtLeast(1)
            }

            val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            bitmap.eraseColor(Color.WHITE) // PDFs assume an opaque white sheet
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            cache.put(key, bitmap)
            bitmap
        }
    }

    suspend fun clearCache() = mutex.withLock { cache.evictAll() }

    fun close() {
        if (closed) return
        closed = true
        cache.evictAll()
        runCatching { renderer.close() }
        runCatching { fileDescriptor.close() }
    }

    companion object {
        private const val MIN_WIDTH = 96
        private const val MAX_WIDTH = 2560
        private const val MAX_AREA = 4096L * 4096L
        private const val MAX_BUDGET_BYTES = 96 * 1024 * 1024 // 96 MB ceiling

        /** ~1/8 of the heap, capped, as the page-bitmap cache budget. */
        fun defaultCacheBudget(): Int {
            val eighth = (Runtime.getRuntime().maxMemory() / 8L)
            return eighth.coerceIn(16L * 1024 * 1024, MAX_BUDGET_BYTES.toLong()).toInt()
        }
    }
}
