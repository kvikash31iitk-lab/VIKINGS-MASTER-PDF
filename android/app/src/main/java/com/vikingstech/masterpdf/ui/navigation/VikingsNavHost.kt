package com.vikingstech.masterpdf.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.hilt.navigation.compose.hiltViewModel
import com.vikingstech.masterpdf.ui.settings.SettingsViewModel
import com.vikingstech.masterpdf.domain.model.ThemeMode
import androidx.navigation.navArgument
import com.vikingstech.masterpdf.ui.home.HomeScreen
import com.vikingstech.masterpdf.ui.scan.ScanScreen
import com.vikingstech.masterpdf.ui.settings.SettingsScreen
import com.vikingstech.masterpdf.ui.tools.ToolsScreen
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
            val settingsViewModel: SettingsViewModel = hiltViewModel()
            val settingsState = settingsViewModel.settings.collectAsStateWithLifecycle()
            val settings = settingsState.value

            HomeScreen(
                onOpenDocument = { uri -> navController.navigate(Routes.viewer(uri)) },
                onContinueReading = { uri, page -> navController.navigate(Routes.viewer(uri, page)) },
                onScan = { navController.navigate(Routes.SCAN) },
                onTools = { navController.navigate(Routes.tools()) },
                onSettings = { navController.navigate(Routes.SETTINGS) },
                settings = settings,
                onToggleTheme = {
                    val nextMode = if (settings.themeMode == ThemeMode.LIGHT) {
                        ThemeMode.DARK
                    } else {
                        ThemeMode.LIGHT
                    }
                    settingsViewModel.edit { it.copy(themeMode = nextMode) }
                }
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

