package com.vikingstech.masterpdf.domain.model

data class PdfFormField(
    val name: String,
    val type: FormFieldType,
    val pageIndex: Int,
    val x: Float,
    val y: Float,
    val width: Float,
    val height: Float,
    val value: String = "",
    val defaultValue: String = "",
    val options: List<String> = emptyList(),
    val isReadOnly: Boolean = false,
    val isRequired: Boolean = false
)

enum class FormFieldType {
    TEXT,
    CHECKBOX,
    RADIO,
    COMBO_BOX,
    LIST_BOX,
    SIGNATURE,
    BUTTON,
    UNKNOWN
}
