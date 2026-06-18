package com.vikingstech.masterpdf.data.pdf

import android.content.Context
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader

/**
 * PdfBox-Android must load its font/resource assets from the APK before any
 * PDDocument is touched. Call once from Application.onCreate().
 */
object PdfBoxInitializer {
    @Volatile private var initialized = false

    fun init(context: Context) {
        if (initialized) return
        synchronized(this) {
            if (initialized) return
            PDFBoxResourceLoader.init(context.applicationContext)
            initialized = true
        }
    }
}
