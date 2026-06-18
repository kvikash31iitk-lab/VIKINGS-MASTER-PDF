package com.vikingstech.masterpdf.ui.navigation

import android.net.Uri

/** Centralised navigation routes and type-safe argument builders. */
object Routes {
    const val HOME = "home"
    const val VIEWER = "viewer/{uri}?startPage={startPage}"
    const val SCAN = "scan"
    const val TOOLS = "tools?uri={uri}"
    const val SETTINGS = "settings"

    const val ARG_URI = "uri"
    const val ARG_START_PAGE = "startPage"

    /** Open the viewer at [documentUri], optionally restoring [startPage]. */
    fun viewer(documentUri: String, startPage: Int = 0): String =
        "viewer/${Uri.encode(documentUri)}?startPage=$startPage"

    /** Open Tools, optionally bound to an already-known document [documentUri]. */
    fun tools(documentUri: String? = null): String =
        if (documentUri != null) "tools?uri=${Uri.encode(documentUri)}" else "tools"
}
