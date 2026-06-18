package com.vikingstech.masterpdf.ui.navigation

import android.net.Uri

/** Centralised navigation routes and type-safe argument builders. */
object Routes {
    const val HOME = "home"
    const val VIEWER = "viewer/{uri}"
    const val SCAN = "scan"
    const val TOOLS = "tools"
    const val SETTINGS = "settings"

    const val ARG_URI = "uri"

    fun viewer(documentUri: String): String = "viewer/${Uri.encode(documentUri)}"
}
