package com.vikingstech.masterpdf.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vikingstech.masterpdf.domain.model.AppSettings
import com.vikingstech.masterpdf.domain.model.ChatMessage
import com.vikingstech.masterpdf.domain.model.ChatRole
import com.vikingstech.masterpdf.domain.usecase.ObserveSettingsUseCase
import com.vikingstech.masterpdf.domain.usecase.StreamAiResponseUseCase
import com.vikingstech.masterpdf.domain.usecase.UpdateSettingsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Outcome of a "Test connection" tap, surfaced to the screen as a one-shot event. */
sealed interface TestConnectionResult {
    data object Ok : TestConnectionResult
    data object NoUrl : TestConnectionResult
    data class Failed(val message: String) : TestConnectionResult
}

@HiltViewModel
class SettingsViewModel @Inject constructor(
    observeSettings: ObserveSettingsUseCase,
    private val updateSettings: UpdateSettingsUseCase,
    private val streamAiResponse: StreamAiResponseUseCase
) : ViewModel() {

    val settings: StateFlow<AppSettings> = observeSettings()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppSettings())

    private val _isTesting = MutableStateFlow(false)
    val isTesting: StateFlow<Boolean> = _isTesting.asStateFlow()

    private val _testResult = MutableSharedFlow<TestConnectionResult>(extraBufferCapacity = 1)
    val testResult: SharedFlow<TestConnectionResult> = _testResult.asSharedFlow()

    /** Apply an immutable transform to the current settings and persist it. */
    fun edit(transform: (AppSettings) -> AppSettings) = viewModelScope.launch {
        updateSettings(transform(settings.value))
    }

    /** Fire a minimal ping at the configured endpoint and report success/failure. */
    fun testConnection() = viewModelScope.launch {
        if (settings.value.aiBaseUrl.isBlank()) {
            _testResult.tryEmit(TestConnectionResult.NoUrl)
            return@launch
        }
        _isTesting.value = true
        val outcome = runCatching {
            streamAiResponse(listOf(ChatMessage(role = ChatRole.USER, content = "ping"))).firstOrNull()
        }
        _isTesting.value = false
        _testResult.tryEmit(
            if (outcome.isSuccess) {
                TestConnectionResult.Ok
            } else {
                TestConnectionResult.Failed(outcome.exceptionOrNull()?.message ?: "Unknown error")
            }
        )
    }
}
