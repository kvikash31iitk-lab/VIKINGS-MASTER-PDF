package com.vikingstech.masterpdf.ui.tools

import com.vikingstech.masterpdf.ui.navigation.Routes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Verifies how the hub routes each tool (the logic behind ToolsHubScreen's
 * onToolClick) and that the route builders carry the right arguments.
 */
class ToolLaunchRoutingTest {

    @Test
    fun `edit and sign open the viewer`() {
        assertEquals(ToolLaunch.VIEWER, PdfToolRegistry.byId(PdfToolId.EDIT).launch)
        assertEquals(ToolLaunch.VIEWER, PdfToolRegistry.byId(PdfToolId.SIGN).launch)
    }

    @Test
    fun `organize opens the page-tools accordion`() {
        assertEquals(ToolLaunch.ORGANIZE, PdfToolRegistry.byId(PdfToolId.ORGANIZE).launch)
    }

    @Test
    fun `every other tool opens the generic workflow`() {
        val special = setOf(PdfToolId.EDIT, PdfToolId.SIGN, PdfToolId.ORGANIZE)
        PdfToolRegistry.tools.filter { it.id !in special }.forEach {
            assertEquals("${it.id} should route to WORKFLOW", ToolLaunch.WORKFLOW, it.launch)
        }
    }

    @Test
    fun `exactly three tools route off the workflow path`() {
        // Reachability/parity: only Edit, Sign, Organize bypass the generic workflow.
        val nonWorkflow = PdfToolRegistry.tools.filter { it.launch != ToolLaunch.WORKFLOW }.map { it.id }.toSet()
        assertEquals(setOf(PdfToolId.EDIT, PdfToolId.SIGN, PdfToolId.ORGANIZE), nonWorkflow)
    }

    @Test
    fun `workflow route carries the tool id`() {
        val route = Routes.toolWorkflow(PdfToolId.COMPRESS.name)
        assertTrue(route.startsWith("toolwf/"))
        assertTrue(route.contains("COMPRESS"))
    }

    @Test
    fun `page-tools route encodes the source uri`() {
        val route = Routes.pageTools("content://docs/42")
        assertTrue(route.startsWith("pagetools"))
        assertTrue(route.contains("uri="))
    }
}
