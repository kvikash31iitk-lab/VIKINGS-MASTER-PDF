package com.vikingstech.masterpdf.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.domain.usecase.ObserveRecentsUseCase
import com.vikingstech.masterpdf.domain.usecase.RemoveRecentUseCase
import com.vikingstech.masterpdf.domain.usecase.TogglePinRecentUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    observeRecents: ObserveRecentsUseCase,
    private val togglePin: TogglePinRecentUseCase,
    private val removeRecent: RemoveRecentUseCase
) : ViewModel() {

    val recents: StateFlow<List<RecentDocument>> = observeRecents()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setPinned(uri: String, pinned: Boolean) = viewModelScope.launch {
        togglePin(uri, pinned)
    }

    fun remove(uri: String) = viewModelScope.launch {
        removeRecent(uri)
    }
}
