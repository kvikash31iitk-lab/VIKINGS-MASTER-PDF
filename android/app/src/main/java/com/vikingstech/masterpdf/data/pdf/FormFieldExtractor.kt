package com.vikingstech.masterpdf.data.pdf

import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDCheckBox
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDComboBox
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDField
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDListBox
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDRadioButton
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDSignatureField
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDTextField
import com.vikingstech.masterpdf.domain.model.FormFieldType
import com.vikingstech.masterpdf.domain.model.PdfFormField
import java.io.File

object FormFieldExtractor {

    fun extractFields(pdfFile: File): List<PdfFormField> {
        val fields = mutableListOf<PdfFormField>()
        PDDocument.load(pdfFile, MemoryUsageSetting.setupTempFileOnly()).use { doc ->
            val acroForm = doc.documentCatalog.acroForm ?: return emptyList()

            acroForm.fields.forEach { field ->
                val formField = parseField(field, doc)
                if (formField != null) {
                    fields.add(formField)
                }
            }
        }
        return fields
    }

    private fun parseField(field: PDField, doc: PDDocument): PdfFormField? {
        val name = field.fullyQualifiedName ?: return null
        val widget = field.widgets.firstOrNull() ?: return null
        val rect = widget.rectangle ?: return null

        val type = when (field) {
            is PDTextField -> FormFieldType.TEXT
            is PDCheckBox -> FormFieldType.CHECKBOX
            is PDRadioButton -> FormFieldType.RADIO
            is PDComboBox -> FormFieldType.COMBO_BOX
            is PDListBox -> FormFieldType.LIST_BOX
            is PDSignatureField -> FormFieldType.SIGNATURE
            else -> FormFieldType.UNKNOWN
        }

        val pageIndex = doc.pages.withIndex().firstOrNull { (_, page) ->
            page.annotations?.contains(widget) == true
        }?.index ?: 0

        val value = field.valueAsString ?: ""
        val defaultValue = (field as? PDTextField)?.defaultValue ?: ""
        val options = when (field) {
            is PDComboBox -> field.optionsExportValues.orEmpty()
            is PDListBox -> field.optionsExportValues.orEmpty()
            else -> emptyList()
        }

        return PdfFormField(
            name = name,
            type = type,
            pageIndex = pageIndex,
            x = rect.lowerLeftX,
            y = rect.lowerLeftY,
            width = rect.width,
            height = rect.height,
            value = value,
            defaultValue = defaultValue,
            options = options,
            isReadOnly = field.isReadOnly,
            isRequired = field.isRequired
        )
    }
}
