package com.vikingstech.masterpdf.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.vikingstech.masterpdf.ui.home.HomeScreen
import com.vikingstech.masterpdf.ui.scan.ScanScreen
import com.vikingstech.masterpdf.ui.settings.SettingsScreen
import com.vikingstech.masterpdf.ui.tools.ToolsScreen
import com.vikingstech.masterpdf.ui.viewer.ViewerScreen

@Composable
fun VikingsNavHost(navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = Routes.HOME) {
        composable(Routes.HOME) {
            HomeScreen(
                onOpenDocument = { uri -> navController.navigate(Routes.viewer(uri)) },
                onContinueReading = { uri, page -> navController.navigate(Routes.viewer(uri, page)) },
                onScan = { navController.navigate(Routes.SCAN) },
                onTools = { navController.navigate(Routes.tools()) },
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
                onOpenTools = { uri -> navController.navigate(Routes.tools(uri)) }
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
        composable(
            route = Routes.TOOLS,
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
