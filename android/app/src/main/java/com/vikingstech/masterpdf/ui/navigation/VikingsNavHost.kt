package com.vikingstech.masterpdf.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.vikingstech.masterpdf.ui.home.HomeScreen
import com.vikingstech.masterpdf.ui.scan.ScanScreen
import com.vikingstech.masterpdf.ui.settings.SettingsScreen
import com.vikingstech.masterpdf.ui.tools.ToolsHubScreen
import com.vikingstech.masterpdf.ui.tools.ToolsScreen
import com.vikingstech.masterpdf.ui.tools.workflow.ToolWorkflowScreen
import com.vikingstech.masterpdf.ui.viewer.ViewerScreen

@Composable
fun VikingsNavHost(
    navController: NavHostController = rememberNavController(),
    /** URI from an ACTION_VIEW intent (e.g. "Open with…" from another app). */
    initialUri: String? = null
) {
    // If the activity was launched by an external app with a PDF URI, navigate
    // directly to the viewer. LaunchedEffect(initialUri) re-runs whenever
    // onNewIntent delivers a new URI (the mutableState in MainActivity triggers
    // recomposition).
    LaunchedEffect(initialUri) {
        if (!initialUri.isNullOrBlank()) {
            navController.navigate(Routes.viewer(initialUri)) {
                // Keep Home in the back-stack so the user can press Back to get there.
                launchSingleTop = true
            }
        }
    }

    NavHost(navController = navController, startDestination = Routes.HOME) {
        composable(Routes.HOME) {
            HomeScreen(
                onOpenDocument = { uri -> navController.navigate(Routes.viewer(uri)) },
                onContinueReading = { uri, page -> navController.navigate(Routes.viewer(uri, page)) },
                onScan = { navController.navigate(Routes.SCAN) },
                onTools = { navController.navigate(Routes.TOOLS) },
                onSettings = { navController.navigate(Routes.SETTINGS) }
            )
        }
        composable(
            route = Routes.VIEWER,
            arguments = listOf(
                navArgument(Routes.ARG_URI) { type = NavType.StringType },
                navArgument(Routes.ARG_START_PAGE) {
                    type = NavType.IntType
                    defaultValue = 0
                }
            )
        ) {
            ViewerScreen(
                onBack = { navController.popBackStack() },
                onOpenTools = { uri -> navController.navigate(Routes.pageTools(uri)) }
            )
        }
        composable(Routes.SCAN) {
            ScanScreen(
                onBack = { navController.popBackStack() },
                onScanned = { uri ->
                    navController.navigate(Routes.viewer(uri)) {
                        popUpTo(Routes.HOME)
                    }
                }
            )
        }
        // Tools hub — the professional grid of every tool.
        composable(Routes.TOOLS) {
            ToolsHubScreen(
                onBack = { navController.popBackStack() },
                onOpenWorkflow = { toolId -> navController.navigate(Routes.toolWorkflow(toolId)) },
                onOpenViewer = { uri -> navController.navigate(Routes.viewer(uri)) },
                onOpenOrganize = { uri -> navController.navigate(Routes.pageTools(uri)) }
            )
        }
        // A single tool's workflow.
        composable(
            route = Routes.TOOL_WORKFLOW,
            arguments = listOf(
                navArgument(Routes.ARG_TOOL_ID) { type = NavType.StringType },
                navArgument(Routes.ARG_URI) {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) {
            ToolWorkflowScreen(onBack = { navController.popBackStack() })
        }
        // Page-editing accordion (Organize / viewer "page tools").
        composable(
            route = Routes.PAGE_TOOLS,
            arguments = listOf(
                navArgument(Routes.ARG_URI) {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            )
        ) {
            ToolsScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
    }
}
