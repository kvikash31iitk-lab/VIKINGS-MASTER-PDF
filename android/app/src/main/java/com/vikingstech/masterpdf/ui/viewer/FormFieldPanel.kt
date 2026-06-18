package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Divider
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.vikingstech.masterpdf.domain.model.FormFieldType
import com.vikingstech.masterpdf.domain.model.PdfFormField

@Composable
fun FormFieldPanel(
    fields: List<PdfFormField>,
    fieldValues: Map<String, String>,
    onFieldValueChanged: (String, String) -> Unit,
    onFieldSubmitted: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        items(fields, key = { it.name }) { field ->
            FormFieldRow(
                field = field,
                value = fieldValues[field.name] ?: "",
                onValueChanged = { onFieldValueChanged(field.name, it) },
                onSubmitted = { onFieldSubmitted(field.name) }
            )
            Divider(modifier = Modifier.padding(vertical = 8.dp))
        }
    }
}

@Composable
private fun FormFieldRow(
    field: PdfFormField,
    value: String,
    onValueChanged: (String) -> Unit,
    onSubmitted: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = field.name,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(bottom = 4.dp)
        )

        when (field.type) {
            FormFieldType.TEXT -> {
                OutlinedTextField(
                    value = value,
                    onValueChange = onValueChanged,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Enter value") },
                    readOnly = field.isReadOnly,
                    singleLine = true
                )
            }
            FormFieldType.CHECKBOX -> {
                Checkbox(
                    checked = value.equals("Yes", ignoreCase = true) || value.equals("True", ignoreCase = true),
                    onCheckedChange = { checked ->
                        onValueChanged(if (checked) "Yes" else "No")
                        onSubmitted()
                    },
                    modifier = Modifier.align(Alignment.Start),
                    enabled = !field.isReadOnly
                )
            }
            FormFieldType.RADIO -> {
                var expanded by remember { mutableStateOf(false) }
                androidx.compose.material3.OutlinedButton(
                    onClick = { expanded = true },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !field.isReadOnly
                ) {
                    Text(value.ifEmpty { "Select option" })
                }
                DropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    field.options.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option) },
                            onClick = {
                                onValueChanged(option)
                                onSubmitted()
                                expanded = false
                            }
                        )
                    }
                }
            }
            FormFieldType.COMBO_BOX, FormFieldType.LIST_BOX -> {
                var expanded by remember { mutableStateOf(false) }
                androidx.compose.material3.OutlinedButton(
                    onClick = { expanded = true },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !field.isReadOnly
                ) {
                    Text(value.ifEmpty { "Select option" })
                }
                DropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    field.options.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option) },
                            onClick = {
                                onValueChanged(option)
                                onSubmitted()
                                expanded = false
                            }
                        )
                    }
                }
            }
            else -> {
                Text("Unsupported field type: ${field.type}")
            }
        }
    }
}
