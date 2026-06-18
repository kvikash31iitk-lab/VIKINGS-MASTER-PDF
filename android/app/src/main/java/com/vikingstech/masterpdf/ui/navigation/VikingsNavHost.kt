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
                onScan = { navController.navigate(Routes.SCAN) },
                onTools = { navController.navigate(Routes.TOOLS) },
                onSettings = { navController.navigate(Routes.SETTINGS) }
            )
        }
        composable(
            route = Routes.VIEWER,
            arguments = listOf(navArgument(Routes.ARG_URI) { type = NavType.StringType })
        ) {
            ViewerScreen(onBack = { navController.popBackStack() })
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
        composable(Routes.TOOLS) {
            ToolsScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
    }
}
