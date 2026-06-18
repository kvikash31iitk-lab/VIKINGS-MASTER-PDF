package com.vikingstech.masterpdf.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vikingstech.masterpdf.domain.model.AppSettings
import com.vikingstech.masterpdf.domain.usecase.ObserveSettingsUseCase
import com.vikingstech.masterpdf.domain.usecase.UpdateSettingsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    observeSettings: ObserveSettingsUseCase,
    private val updateSettings: UpdateSettingsUseCase
) : ViewModel() {

    val settings: StateFlow<AppSettings> = observeSettings()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppSettings())

    /** Apply an immutable transform to the current settings and persist it. */
    fun edit(transform: (AppSettings) -> AppSettings) = viewModelScope.launch {
        updateSettings(transform(settings.value))
    }
}
