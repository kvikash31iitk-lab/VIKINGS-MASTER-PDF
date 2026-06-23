package com.vikingstech.masterpdf.ui.viewer

import androidx.lifecycle.SavedStateHandle
import com.vikingstech.masterpdf.domain.model.CustomStamp
import com.vikingstech.masterpdf.domain.model.FormFieldType
import com.vikingstech.masterpdf.domain.model.PdfFormField
import com.vikingstech.masterpdf.domain.model.PdfPageInfo
import com.vikingstech.masterpdf.domain.model.StrokePoint
import com.vikingstech.masterpdf.domain.usecase.AddBookmarkUseCase
import com.vikingstech.masterpdf.domain.usecase.AddSignatureUseCase
import com.vikingstech.masterpdf.domain.usecase.CloseDocumentUseCase
import com.vikingstech.masterpdf.domain.usecase.CommitInkAnnotationUseCase
import com.vikingstech.masterpdf.domain.usecase.CommitSignatureUseCase
import com.vikingstech.masterpdf.domain.usecase.CommitStampUseCase
import com.vikingstech.masterpdf.domain.usecase.DeleteBookmarkUseCase
import com.vikingstech.masterpdf.domain.usecase.ExtractAllTextUseCase
import com.vikingstech.masterpdf.domain.usecase.ExtractTextUseCase
import com.vikingstech.masterpdf.domain.usecase.FillFormFieldUseCase
import com.vikingstech.masterpdf.domain.usecase.FillFormFieldsUseCase
import com.vikingstech.masterpdf.domain.usecase.GetCustomStampsUseCase
import com.vikingstech.masterpdf.domain.usecase.GetFormFieldsUseCase
import com.vikingstech.masterpdf.domain.usecase.GetPageInfoUseCase
import com.vikingstech.masterpdf.domain.usecase.ObserveBookmarksUseCase
import com.vikingstech.masterpdf.domain.usecase.ObserveSignaturesUseCase
import com.vikingstech.masterpdf.domain.usecase.OpenDocumentUseCase
import com.vikingstech.masterpdf.domain.usecase.RenderPageUseCase
import com.vikingstech.masterpdf.domain.usecase.SaveCustomStampUseCase
import com.vikingstech.masterpdf.domain.usecase.StreamAiResponseUseCase
import com.vikingstech.masterpdf.domain.usecase.UpdateLastPageUseCase
import com.vikingstech.masterpdf.fakes.FakeAiRepository
import com.vikingstech.masterpdf.fakes.FakeBookmarkRepository
import com.vikingstech.masterpdf.fakes.FakeCustomStampRepository
import com.vikingstech.masterpdf.fakes.FakeDocumentRepository
import com.vikingstech.masterpdf.fakes.FakeRecentsRepository
import com.vikingstech.masterpdf.fakes.FakeSignatureRepository
import com.vikingstech.masterpdf.ui.navigation.Routes
import com.vikingstech.masterpdf.util.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ViewerViewModelTest {

    @get:Rule
    val mainRule = MainDispatcherRule(UnconfinedTestDispatcher())

    private fun viewModel(docRepo: FakeDocumentRepository): ViewerViewModel {
        val recents = FakeRecentsRepository()
        val stamps = FakeCustomStampRepository()
        val bookmarks = FakeBookmarkRepository()
        val signatures = FakeSignatureRepository()
        val ai = FakeAiRepository()
        return ViewerViewModel(
            savedStateHandle = SavedStateHandle(mapOf(Routes.ARG_URI to "doc://test")),
            io = UnconfinedTestDispatcher(),
            openDocument = OpenDocumentUseCase(docRepo, recents),
            getPageInfo = GetPageInfoUseCase(docRepo),
            renderPageUseCase = RenderPageUseCase(docRepo),
            closeDocument = CloseDocumentUseCase(docRepo),
            commitInkAnnotation = CommitInkAnnotationUseCase(docRepo),
            getFormFields = GetFormFieldsUseCase(docRepo),
            fillFormField = FillFormFieldUseCase(docRepo),
            fillFormFields = FillFormFieldsUseCase(docRepo),
            getCustomStamps = GetCustomStampsUseCase(stamps),
            saveCustomStamp = SaveCustomStampUseCase(stamps),
            commitStamp = CommitStampUseCase(docRepo),
            observeBookmarks = ObserveBookmarksUseCase(bookmarks),
            addBookmarkUseCase = AddBookmarkUseCase(bookmarks),
            deleteBookmarkUseCase = DeleteBookmarkUseCase(bookmarks),
            streamAiResponse = StreamAiResponseUseCase(ai),
            extractAllText = ExtractAllTextUseCase(docRepo),
            extractText = ExtractTextUseCase(docRepo),
            observeSignatures = ObserveSignaturesUseCase(signatures),
            addSignature = AddSignatureUseCase(signatures),
            commitSignatureUseCase = CommitSignatureUseCase(docRepo),
            updateLastPage = UpdateLastPageUseCase(recents)
        )
    }

    private fun threePageRepo() = FakeDocumentRepository().apply {
        pages = listOf(
            PdfPageInfo(index = 0, widthPx = 100, heightPx = 200),
            PdfPageInfo(index = 1, widthPx = 100, heightPx = 200),
            PdfPageInfo(index = 2, widthPx = 100, heightPx = 200)
        )
    }

    @Test
    fun `zoom level is a single shared value and reset returns to 1x`() {
        val vm = viewModel(threePageRepo())
        vm.onZoomChanged(2.5f)
        assertEquals(2.5f, vm.state.value.zoomLevel, 0.001f)
        vm.resetZoom()
        assertEquals(1f, vm.state.value.zoomLevel, 0.001f)
    }

    @Test
    fun `drawing strokes are stored per page`() {
        val vm = viewModel(threePageRepo())

        // Draw a stroke on page 2.
        vm.addPointToCurrentStroke(2, StrokePoint(0f, 0f))
        vm.addPointToCurrentStroke(2, StrokePoint(1f, 1f))
        vm.finishStroke(2)

        // Draw a stroke on page 0.
        vm.addPointToCurrentStroke(0, StrokePoint(0f, 0f))
        vm.addPointToCurrentStroke(0, StrokePoint(0.5f, 0.5f))
        vm.finishStroke(0)

        val strokes = vm.state.value.pageStrokes
        assertEquals(1, strokes[2]?.size)
        assertEquals(1, strokes[0]?.size)
        assertEquals(2, strokes[2]?.first()?.pageIndex)
        assertEquals(0, strokes[0]?.first()?.pageIndex)
    }

    @Test
    fun `commitStrokes commits one ink annotation per drawn page`() {
        val repo = threePageRepo()
        val vm = viewModel(repo)

        vm.addPointToCurrentStroke(2, StrokePoint(0f, 0f))
        vm.addPointToCurrentStroke(2, StrokePoint(1f, 1f))
        vm.finishStroke(2)
        vm.addPointToCurrentStroke(0, StrokePoint(0f, 0f))
        vm.addPointToCurrentStroke(0, StrokePoint(1f, 1f))
        vm.finishStroke(0)

        vm.commitStrokes()

        assertEquals(2, repo.inkAnnotations.size)
        assertEquals(setOf(0, 2), repo.inkAnnotations.map { it.pageIndex }.toSet())
    }

    @Test
    fun `applyAllFormFields saves edited values in one pass`() {
        val repo = threePageRepo().apply {
            formFields = listOf(
                PdfFormField("Name", FormFieldType.TEXT, pageIndex = 0, x = 0f, y = 0f, width = 10f, height = 10f),
                PdfFormField("Locked", FormFieldType.TEXT, pageIndex = 0, x = 0f, y = 0f, width = 10f, height = 10f, isReadOnly = true)
            )
        }
        val vm = viewModel(repo)
        vm.updateFormFieldValue("Name", "Ragnar")
        vm.updateFormFieldValue("Locked", "nope")

        vm.applyAllFormFields()

        // Only the editable field is saved; the read-only one is excluded.
        val saved = repo.filledFields.lastOrNull().orEmpty()
        assertEquals("Ragnar", saved["Name"])
        assertTrue("read-only field must not be saved", !saved.containsKey("Locked"))
    }

    @Test
    fun `commitStampPlacement stamps the active placement page`() {
        val repo = threePageRepo()
        val vm = viewModel(repo)
        val stamp = CustomStamp(name = "Approved", text = "APPROVED")

        vm.beginStampPlacement(stamp) // targets the current page (0)
        vm.commitStampPlacement(0.1f, 0.1f, 0.5f, 0.25f)

        assertEquals(listOf(0), repo.textStampPages)
    }

    @Test
    fun `initialFormValues seeds from extracted field values`() {
        val fields = listOf(
            PdfFormField("A", FormFieldType.TEXT, 0, 0f, 0f, 1f, 1f, value = "x"),
            PdfFormField("B", FormFieldType.CHECKBOX, 0, 0f, 0f, 1f, 1f, value = "Yes")
        )
        val seeded = initialFormValues(fields)
        assertEquals("x", seeded["A"])
        assertEquals("Yes", seeded["B"])
    }
}
