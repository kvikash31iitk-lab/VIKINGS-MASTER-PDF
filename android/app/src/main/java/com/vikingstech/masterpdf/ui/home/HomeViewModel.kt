package com.vikingstech.masterpdf.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.domain.model.SortMode
import com.vikingstech.masterpdf.domain.usecase.ObserveRecentsUseCase
import com.vikingstech.masterpdf.domain.usecase.RemoveRecentUseCase
import com.vikingstech.masterpdf.domain.usecase.TogglePinRecentUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    observeRecents: ObserveRecentsUseCase,
    private val togglePin: TogglePinRecentUseCase,
    private val removeRecent: RemoveRecentUseCase
) : ViewModel() {

    private val rawRecents: StateFlow<List<RecentDocument>> = observeRecents()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _sortMode = MutableStateFlow(SortMode.RECENT)
    val sortMode: StateFlow<SortMode> = _sortMode.asStateFlow()

    /** The list shown in the recents area, after search + sort. */
    val displayed: StateFlow<List<RecentDocument>> =
        combine(rawRecents, _searchQuery, _sortMode) { list, query, mode ->
            sortRecents(filterRecents(list, query), mode)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** Most recently opened document, surfaced as the "Continue Reading" hero. */
    val hero: StateFlow<RecentDocument?> = rawRecents
        .map { list -> list.maxByOrNull { it.lastOpenedAt } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** True when a search is active but nothing matches (vs. an empty library). */
    val hasAnyRecents: StateFlow<Boolean> = rawRecents
        .map { it.isNotEmpty() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    fun setSearch(query: String) { _searchQuery.value = query }

    fun setSort(mode: SortMode) { _sortMode.value = mode }

    fun setPinned(uri: String, pinned: Boolean) = viewModelScope.launch {
        togglePin(uri, pinned)
    }

    fun remove(uri: String) = viewModelScope.launch {
        removeRecent(uri)
    }
}

/** Case-insensitive name filter. Pure for testability. */
fun filterRecents(list: List<RecentDocument>, query: String): List<RecentDocument> {
    val q = query.trim()
    return if (q.isEmpty()) list else list.filter { it.name.contains(q, ignoreCase = true) }
}

/** Apply a [SortMode] ordering. Pure for testability. */
fun sortRecents(list: List<RecentDocument>, mode: SortMode): List<RecentDocument> = when (mode) {
    SortMode.RECENT -> list.sortedWith(
        compareByDescending<RecentDocument> { it.isPinned }.thenByDescending { it.lastOpenedAt }
    )
    SortMode.PINNED -> list.filter { it.isPinned }.sortedByDescending { it.lastOpenedAt }
    SortMode.LARGEST -> list.sortedByDescending { it.sizeBytes }
    SortMode.SMALLEST -> list.sortedBy { it.sizeBytes }
    SortMode.AZ -> list.sortedBy { it.name.lowercase() }
}
