package com.vikingstech.masterpdf.ui.tools

import androidx.lifecycle.SavedStateHandle
import com.vikingstech.masterpdf.domain.usecase.CloseDocumentUseCase
import com.vikingstech.masterpdf.domain.usecase.CompressPdfUseCase
import com.vikingstech.masterpdf.domain.usecase.DeletePagesUseCase
import com.vikingstech.masterpdf.domain.usecase.ExtractAllTextUseCase
import com.vikingstech.masterpdf.domain.usecase.GetPageInfoUseCase
import com.vikingstech.masterpdf.domain.usecase.MergePdfsUseCase
import com.vikingstech.masterpdf.domain.usecase.OpenDocumentUseCase
import com.vikingstech.masterpdf.domain.usecase.RenderPageUseCase
import com.vikingstech.masterpdf.domain.usecase.ReorderPagesUseCase
import com.vikingstech.masterpdf.domain.usecase.RotatePagesUseCase
import com.vikingstech.masterpdf.domain.usecase.SaveDocumentUseCase
import com.vikingstech.masterpdf.fakes.FakeDocumentRepository
import com.vikingstech.masterpdf.fakes.FakeRecentsRepository
import com.vikingstech.masterpdf.util.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ToolsViewModelTest {

    @get:Rule
    val mainRule = MainDispatcherRule(UnconfinedTestDispatcher())

    private fun viewModel(): ToolsViewModel {
        val docRepo = FakeDocumentRepository()
        val recentsRepo = FakeRecentsRepository()
        return ToolsViewModel(
            savedStateHandle = SavedStateHandle(),
            openDocument = OpenDocumentUseCase(docRepo, recentsRepo),
            getPageInfo = GetPageInfoUseCase(docRepo),
            renderPageUseCase = RenderPageUseCase(docRepo),
            reorderPages = ReorderPagesUseCase(docRepo),
            deletePages = DeletePagesUseCase(docRepo),
            rotatePages = RotatePagesUseCase(docRepo),
            compressPdf = CompressPdfUseCase(docRepo),
            extractAllText = ExtractAllTextUseCase(docRepo),
            mergePdfs = MergePdfsUseCase(docRepo),
            saveDocument = SaveDocumentUseCase(docRepo),
            closeDocument = CloseDocumentUseCase(docRepo)
        )
    }

    @Test
    fun `initial state has no document`() {
        val vm = viewModel()
        val s = vm.state.value
        assertFalse(s.hasDocument)
        assertEquals(0, s.pageCount)
        assertEquals(emptyList<MergeFile>(), s.mergeFiles)
        assertNull(s.expandedSection)
    }

    @Test
    fun `add remove and move merge files`() {
        val vm = viewModel()
        vm.addMergeFiles(listOf(MergeFile("a", "A.pdf"), MergeFile("b", "B.pdf")))
        assertEquals(listOf("a", "b"), vm.state.value.mergeFiles.map { it.uri })

        vm.moveMergeFile(0, 1)
        assertEquals(listOf("b", "a"), vm.state.value.mergeFiles.map { it.uri })

        vm.removeMergeFile(0)
        assertEquals(listOf("a"), vm.state.value.mergeFiles.map { it.uri })
    }

    @Test
    fun `pageEditError flags deleting every page`() {
        assertNotNull(pageEditError(0))
        assertNull(pageEditError(1))
        assertNull(pageEditError(5))
    }

    @Test
    fun `setExpanded toggles the open section`() {
        val vm = viewModel()
        vm.setExpanded(ToolSection.MERGE)
        assertEquals(ToolSection.MERGE, vm.state.value.expandedSection)

        // Tapping the same section collapses it.
        vm.setExpanded(ToolSection.MERGE)
        assertNull(vm.state.value.expandedSection)

        vm.setExpanded(ToolSection.COMPRESS)
        assertEquals(ToolSection.COMPRESS, vm.state.value.expandedSection)
    }
}
