package com.vikingstech.masterpdf.ui.tools

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MergeType
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.BrandingWatermark
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.CallSplit
import androidx.compose.material.icons.filled.Compress
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.DocumentScanner
import androidx.compose.material.icons.filled.Draw
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Numbers
import androidx.compose.material.icons.filled.Photo
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.PostAdd
import androidx.compose.material.icons.filled.Reorder
import androidx.compose.material.icons.filled.RotateRight
import androidx.compose.material.icons.filled.Slideshow
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material.icons.filled.Transform
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import com.vikingstech.masterpdf.R

/** Top-level grouping shown as a section header in the hub. */
enum class ToolCategory { PDF, IMAGE }

/** What the tool needs the user to pick before it can run. */
enum class ToolInput { NONE, SINGLE_PDF, MULTI_PDF, IMAGES, OFFICE_DOC }

/** How the hub launches the tool. */
enum class ToolLaunch { WORKFLOW, VIEWER, ORGANIZE }

/** Stable identifiers for every tool in the hub. */
enum class PdfToolId {
    MERGE, SPLIT, COMPRESS, PDF_TO_WORD, PDF_TO_PPT, PDF_TO_EXCEL,
    WORD_TO_PDF, PPT_TO_PDF, EXCEL_TO_PDF, EDIT, PDF_TO_JPG, IMAGE_TO_PDF,
    PAGE_NUMBERS, WATERMARK, ROTATE, UNLOCK, PROTECT, ORGANIZE, REPAIR,
    SIGN, EXTRACT_TXT, CREATE, OCR, COMPRESS_IMAGE, TO_JPG, FROM_JPG
}

/**
 * A single tool tile. Every field is descriptive — there is intentionally **no**
 * "premium", "locked", "enabled", or "comingSoon" flag anywhere in this model, so
 * by construction the hub can never gate or hide a tool.
 *
 * [searchTerms] holds lowercase keywords/synonyms so search is testable without
 * resolving string resources.
 */
data class PdfTool(
    val id: PdfToolId,
    @StringRes val titleRes: Int,
    @StringRes val descriptionRes: Int,
    val category: ToolCategory,
    val input: ToolInput,
    val launch: ToolLaunch,
    val icon: ImageVector,
    val tileColor: Color,
    val searchTerms: String
)

object PdfToolRegistry {

    // Tile palette — distinct, theme-independent accent colours for the icon tiles.
    private val Blue = Color(0xFF2563EB)
    private val Red = Color(0xFFE11D48)
    private val Green = Color(0xFF059669)
    private val Amber = Color(0xFFD97706)
    private val Purple = Color(0xFF7C3AED)
    private val Teal = Color(0xFF0D9488)
    private val Indigo = Color(0xFF4F46E5)
    private val Pink = Color(0xFFDB2777)
    private val Orange = Color(0xFFEA580C)
    private val Cyan = Color(0xFF0891B2)
    private val Slate = Color(0xFF475569)

    val tools: List<PdfTool> = listOf(
        PdfTool(PdfToolId.MERGE, R.string.tool_merge_title, R.string.tool_merge_desc,
            ToolCategory.PDF, ToolInput.MULTI_PDF, ToolLaunch.WORKFLOW,
            Icons.AutoMirrored.Filled.MergeType, Blue, "merge combine join pdf"),
        PdfTool(PdfToolId.SPLIT, R.string.tool_split_title, R.string.tool_split_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.CallSplit, Indigo, "split extract pages range divide"),
        PdfTool(PdfToolId.COMPRESS, R.string.tool_compress_title, R.string.tool_compress_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.Compress, Green, "compress shrink reduce size optimise"),
        PdfTool(PdfToolId.PDF_TO_WORD, R.string.tool_pdf_to_word_title, R.string.tool_pdf_to_word_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.Description, Blue, "pdf to word docx document convert"),
        PdfTool(PdfToolId.PDF_TO_PPT, R.string.tool_pdf_to_ppt_title, R.string.tool_pdf_to_ppt_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.Slideshow, Orange, "pdf to powerpoint ppt pptx slides convert"),
        PdfTool(PdfToolId.PDF_TO_EXCEL, R.string.tool_pdf_to_excel_title, R.string.tool_pdf_to_excel_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.TableChart, Green, "pdf to excel xlsx spreadsheet convert"),
        PdfTool(PdfToolId.WORD_TO_PDF, R.string.tool_word_to_pdf_title, R.string.tool_word_to_pdf_desc,
            ToolCategory.PDF, ToolInput.OFFICE_DOC, ToolLaunch.WORKFLOW,
            Icons.Filled.Description, Blue, "word docx to pdf convert document"),
        PdfTool(PdfToolId.PPT_TO_PDF, R.string.tool_ppt_to_pdf_title, R.string.tool_ppt_to_pdf_desc,
            ToolCategory.PDF, ToolInput.OFFICE_DOC, ToolLaunch.WORKFLOW,
            Icons.Filled.Slideshow, Orange, "powerpoint ppt pptx to pdf convert slides"),
        PdfTool(PdfToolId.EXCEL_TO_PDF, R.string.tool_excel_to_pdf_title, R.string.tool_excel_to_pdf_desc,
            ToolCategory.PDF, ToolInput.OFFICE_DOC, ToolLaunch.WORKFLOW,
            Icons.Filled.TableChart, Green, "excel xlsx csv to pdf convert spreadsheet"),
        PdfTool(PdfToolId.EDIT, R.string.tool_edit_title, R.string.tool_edit_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.VIEWER,
            Icons.Filled.Edit, Purple, "edit annotate draw markup pdf"),
        PdfTool(PdfToolId.PDF_TO_JPG, R.string.tool_pdf_to_jpg_title, R.string.tool_pdf_to_jpg_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.Image, Pink, "pdf to jpg jpeg image export pages"),
        PdfTool(PdfToolId.IMAGE_TO_PDF, R.string.tool_image_to_pdf_title, R.string.tool_image_to_pdf_desc,
            ToolCategory.PDF, ToolInput.IMAGES, ToolLaunch.WORKFLOW,
            Icons.Filled.PictureAsPdf, Pink, "image jpg png to pdf convert photos"),
        PdfTool(PdfToolId.PAGE_NUMBERS, R.string.tool_page_numbers_title, R.string.tool_page_numbers_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.Numbers, Cyan, "page numbers numbering paginate"),
        PdfTool(PdfToolId.WATERMARK, R.string.tool_watermark_title, R.string.tool_watermark_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.BrandingWatermark, Teal, "watermark stamp overlay text"),
        PdfTool(PdfToolId.ROTATE, R.string.tool_rotate_title, R.string.tool_rotate_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.RotateRight, Amber, "rotate turn orientation pages"),
        PdfTool(PdfToolId.UNLOCK, R.string.tool_unlock_title, R.string.tool_unlock_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.LockOpen, Green, "unlock remove password decrypt"),
        PdfTool(PdfToolId.PROTECT, R.string.tool_protect_title, R.string.tool_protect_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.Lock, Red, "protect encrypt password secure"),
        PdfTool(PdfToolId.ORGANIZE, R.string.tool_organize_title, R.string.tool_organize_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.ORGANIZE,
            Icons.Filled.Reorder, Indigo, "organize reorder delete pages manage arrange"),
        PdfTool(PdfToolId.REPAIR, R.string.tool_repair_title, R.string.tool_repair_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.Build, Slate, "repair fix recover damaged corrupt"),
        PdfTool(PdfToolId.SIGN, R.string.tool_sign_title, R.string.tool_sign_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.VIEWER,
            Icons.Filled.Draw, Purple, "sign signature initials"),
        PdfTool(PdfToolId.EXTRACT_TXT, R.string.tool_extract_txt_title, R.string.tool_extract_txt_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.Article, Slate, "extract text txt copy content"),
        PdfTool(PdfToolId.CREATE, R.string.tool_create_title, R.string.tool_create_desc,
            ToolCategory.PDF, ToolInput.NONE, ToolLaunch.WORKFLOW,
            Icons.Filled.PostAdd, Blue, "create new pdf from text blank"),
        PdfTool(PdfToolId.OCR, R.string.tool_ocr_title, R.string.tool_ocr_desc,
            ToolCategory.PDF, ToolInput.SINGLE_PDF, ToolLaunch.WORKFLOW,
            Icons.Filled.DocumentScanner, Teal, "ocr recognise scanned text image searchable"),
        // ── Image tools ──
        PdfTool(PdfToolId.COMPRESS_IMAGE, R.string.tool_compress_image_title, R.string.tool_compress_image_desc,
            ToolCategory.IMAGE, ToolInput.IMAGES, ToolLaunch.WORKFLOW,
            Icons.Filled.Compress, Green, "compress image shrink reduce photo jpg"),
        PdfTool(PdfToolId.TO_JPG, R.string.tool_to_jpg_title, R.string.tool_to_jpg_desc,
            ToolCategory.IMAGE, ToolInput.IMAGES, ToolLaunch.WORKFLOW,
            Icons.Filled.Photo, Pink, "convert to jpg jpeg image png webp"),
        PdfTool(PdfToolId.FROM_JPG, R.string.tool_from_jpg_title, R.string.tool_from_jpg_desc,
            ToolCategory.IMAGE, ToolInput.IMAGES, ToolLaunch.WORKFLOW,
            Icons.Filled.SwapHoriz, Cyan, "convert from jpg to png image transform")
    )

    fun byId(id: PdfToolId): PdfTool = tools.first { it.id == id }

    fun byCategory(category: ToolCategory): List<PdfTool> = tools.filter { it.category == category }

    /** Case-insensitive keyword filter; a blank query returns everything. */
    fun search(query: String): List<PdfTool> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return tools
        return tools.filter { it.searchTerms.contains(q) }
    }
}
