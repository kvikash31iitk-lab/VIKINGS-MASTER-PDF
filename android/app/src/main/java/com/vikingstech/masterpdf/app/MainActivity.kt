package com.vikingstech.masterpdf.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.vikingstech.masterpdf.ui.VikingsApp
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    /**
     * URI delivered via ACTION_VIEW ("Open with…" from another app or file manager).
     * Backed by Compose state so VikingsApp recomposes when onNewIntent fires.
     */
    private var incomingUri by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Capture URI on cold-start.
        incomingUri = intent.extractPdfUri()
        setContent {
            VikingsApp(initialUri = incomingUri)
        }
    }

    /** Called when the activity is already running (singleTop / android:launchMode). */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        incomingUri = intent.extractPdfUri()
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** Extract a PDF content/file URI from an ACTION_VIEW intent, or null if absent. */
    private fun Intent.extractPdfUri(): String? {
        if (action != Intent.ACTION_VIEW) return null
        return data?.toString()
    }
}
