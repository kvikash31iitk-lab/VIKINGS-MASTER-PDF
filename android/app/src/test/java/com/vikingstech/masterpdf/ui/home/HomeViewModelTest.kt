package com.vikingstech.masterpdf.ui.home

import com.vikingstech.masterpdf.domain.model.RecentDocument
import com.vikingstech.masterpdf.domain.model.SortMode
import com.vikingstech.masterpdf.domain.usecase.ObserveRecentsUseCase
import com.vikingstech.masterpdf.domain.usecase.RemoveRecentUseCase
import com.vikingstech.masterpdf.domain.usecase.TogglePinRecentUseCase
import com.vikingstech.masterpdf.fakes.FakeRecentsRepository
import com.vikingstech.masterpdf.util.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {

    @get:Rule
    val mainRule = MainDispatcherRule(UnconfinedTestDispatcher())

    private fun doc(
        uri: String,
        name: String,
        size: Long = 0,
        opened: Long = 0,
        pinned: Boolean = false
    ) = RecentDocument(
        uri = uri,
        name = name,
        pageCount = 1,
        sizeBytes = size,
        lastOpenedAt = opened,
        isPinned = pinned
    )

    private fun viewModel(repo: FakeRecentsRepository) = HomeViewModel(
        observeRecents = ObserveRecentsUseCase(repo),
        togglePin = TogglePinRecentUseCase(repo),
        removeRecent = RemoveRecentUseCase(repo)
    )

    @Test
    fun `filterRecents matches name case-insensitively`() {
        val list = listOf(doc("a", "Invoice March"), doc("b", "Report"), doc("c", "invoice april"))
        val result = filterRecents(list, "invoice")
        assertEquals(2, result.size)
        assertTrue(result.all { it.name.contains("invoice", ignoreCase = true) })
    }

    @Test
    fun `filterRecents returns all when query blank`() {
        val list = listOf(doc("a", "One"), doc("b", "Two"))
        assertEquals(2, filterRecents(list, "   ").size)
    }

    @Test
    fun `sortRecents orders by mode`() {
        val list = listOf(
            doc("a", "Beta", size = 10, opened = 1),
            doc("b", "alpha", size = 30, opened = 3, pinned = true),
            doc("c", "Gamma", size = 20, opened = 2)
        )
        assertEquals(listOf("alpha", "Beta", "Gamma"), sortRecents(list, SortMode.AZ).map { it.name })
        assertEquals(listOf("b", "c", "a"), sortRecents(list, SortMode.LARGEST).map { it.uri })
        assertEquals(listOf("a", "c", "b"), sortRecents(list, SortMode.SMALLEST).map { it.uri })
        // RECENT floats pinned to the top, then by recency.
        assertEquals("b", sortRecents(list, SortMode.RECENT).first().uri)
        assertEquals(1, sortRecents(list, SortMode.PINNED).size)
    }

    @Test
    fun `setSearch and setSort update exposed state`() {
        val vm = viewModel(FakeRecentsRepository())
        vm.setSearch("hello")
        vm.setSort(SortMode.AZ)
        assertEquals("hello", vm.searchQuery.value)
        assertEquals(SortMode.AZ, vm.sortMode.value)
    }

    @Test
    fun `setPinned and remove delegate to repository`() = runTest {
        val repo = FakeRecentsRepository(listOf(doc("a", "One")))
        val vm = viewModel(repo)
        vm.setPinned("a", true)
        vm.remove("a")
        assertEquals(listOf("a" to true), repo.pinnedCalls)
        assertEquals(listOf("a"), repo.removedUris)
    }
}
