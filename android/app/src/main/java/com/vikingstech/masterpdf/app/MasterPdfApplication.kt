package com.vikingstech.masterpdf.app

import android.app.Application
import com.vikingstech.masterpdf.data.pdf.PdfBoxInitializer
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class MasterPdfApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // PdfBox must load its bundled fonts/resources before any document use.
        PdfBoxInitializer.init(this)
    }
}
