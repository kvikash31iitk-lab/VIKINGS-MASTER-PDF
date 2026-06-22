package com.vikingstech.masterpdf.ui.navigation

import android.net.Uri

/** Centralised navigation routes and type-safe argument builders. */
object Routes {
    const val HOME = "home"
    const val VIEWER = "viewer/{uri}?startPage={startPage}"
    const val SCAN = "scan"
    const val TOOLS = "tools"
    const val PAGE_TOOLS = "pagetools?uri={uri}"
    const val TOOL_WORKFLOW = "toolwf/{toolId}?uri={uri}"
    const val SETTINGS = "settings"

    const val ARG_URI = "uri"
    const val ARG_START_PAGE = "startPage"
    const val ARG_TOOL_ID = "toolId"

    /** Open the viewer at [documentUri], optionally restoring [startPage]. */
    fun viewer(documentUri: String, startPage: Int = 0): String =
        "viewer/${Uri.encode(documentUri)}?startPage=$startPage"

    /** Open the page-editing accordion bound to an already-known [documentUri]. */
    fun pageTools(documentUri: String? = null): String =
        if (documentUri != null) "pagetools?uri=${Uri.encode(documentUri)}" else "pagetools"

    /** Open a single tool's workflow, optionally pre-bound to [documentUri]. */
    fun toolWorkflow(toolId: String, documentUri: String? = null): String =
        if (documentUri != null) "toolwf/$toolId?uri=${Uri.encode(documentUri)}" else "toolwf/$toolId"
}
