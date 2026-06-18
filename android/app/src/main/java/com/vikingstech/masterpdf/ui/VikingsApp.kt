package com.vikingstech.masterpdf.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.vikingstech.masterpdf.domain.model.AppSettings
import com.vikingstech.masterpdf.domain.usecase.ObserveSettingsUseCase
import com.vikingstech.masterpdf.ui.navigation.VikingsNavHost
import com.vikingstech.masterpdf.ui.theme.VikingsMasterPdfTheme
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@Composable
fun VikingsApp(viewModel: AppShellViewModel = hiltViewModel()) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    VikingsMasterPdfTheme(
        themeMode = settings.themeMode,
        oledDarkMode = settings.oledDarkMode,
        dynamicColor = settings.dynamicColor
    ) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            VikingsNavHost()
        }
    }
}

@HiltViewModel
class AppShellViewModel @Inject constructor(
    observeSettings: ObserveSettingsUseCase
) : ViewModel() {
    val settings: StateFlow<AppSettings> = observeSettings()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppSettings())
}
