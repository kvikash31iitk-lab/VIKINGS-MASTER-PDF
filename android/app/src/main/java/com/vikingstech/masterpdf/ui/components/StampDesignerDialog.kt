package com.vikingstech.masterpdf.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vikingstech.masterpdf.domain.model.CustomStamp

@Composable
fun StampDesignerDialog(
    onDismiss: () -> Unit,
    onSave: (CustomStamp) -> Unit,
    initialStamp: CustomStamp? = null
) {
    var stampName by remember { mutableStateOf(initialStamp?.name ?: "") }
    var stampText by remember { mutableStateOf(initialStamp?.text ?: "") }
    var textColor by remember { mutableStateOf(initialStamp?.textColor ?: Color.Black) }
    var backgroundColor by remember { mutableStateOf(initialStamp?.backgroundColor ?: Color.White) }
    var borderColor by remember { mutableStateOf(initialStamp?.borderColor ?: Color.Black) }
    var fontSize by remember { mutableStateOf(initialStamp?.fontSize ?: 12f) }
    var borderWidth by remember { mutableStateOf(initialStamp?.borderWidth ?: 1f) }
    var borderRadius by remember { mutableStateOf(initialStamp?.borderRadius ?: 4f) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Design Stamp") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = stampName,
                    onValueChange = { stampName = it },
                    label = { Text("Stamp Name") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                OutlinedTextField(
                    value = stampText,
                    onValueChange = { stampText = it },
                    label = { Text("Stamp Text") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp),
                    maxLines = 2
                )

                Text("Preview:", style = MaterialTheme.typography.labelMedium)
                StampPreview(
                    text = stampText,
                    textColor = textColor,
                    backgroundColor = backgroundColor,
                    borderColor = borderColor,
                    fontSize = fontSize,
                    borderWidth = borderWidth,
                    borderRadius = borderRadius
                )

                ColorSelector("Text Color", textColor) { textColor = it }
                ColorSelector("Background Color", backgroundColor) { backgroundColor = it }
                ColorSelector("Border Color", borderColor) { borderColor = it }

                Text("Font Size: $fontSize")
                Slider(
                    value = fontSize,
                    onValueChange = { fontSize = it },
                    valueRange = 8f..24f,
                    modifier = Modifier.fillMaxWidth()
                )

                Text("Border Width: $borderWidth")
                Slider(
                    value = borderWidth,
                    onValueChange = { borderWidth = it },
                    valueRange = 0f..4f,
                    modifier = Modifier.fillMaxWidth()
                )

                Text("Border Radius: $borderRadius")
                Slider(
                    value = borderRadius,
                    onValueChange = { borderRadius = it },
                    valueRange = 0f..16f,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (stampName.isNotEmpty() && stampText.isNotEmpty()) {
                        val stamp = CustomStamp(
                            id = initialStamp?.id ?: "",
                            name = stampName,
                            text = stampText,
                            textColor = textColor,
                            backgroundColor = backgroundColor,
                            borderColor = borderColor,
                            borderWidth = borderWidth,
                            fontSize = fontSize,
                            borderRadius = borderRadius
                        )
                        onSave(stamp)
                        onDismiss()
                    }
                }
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
private fun StampPreview(
    text: String,
    textColor: Color,
    backgroundColor: Color,
    borderColor: Color,
    fontSize: Float,
    borderWidth: Float,
    borderRadius: Float
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp)
            .background(
                color = backgroundColor,
                shape = RoundedCornerShape(borderRadius.dp)
            )
            .border(
                width = borderWidth.dp,
                color = borderColor,
                shape = RoundedCornerShape(borderRadius.dp)
            )
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text.ifEmpty { "Preview" },
            color = textColor,
            fontSize = fontSize.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun ColorSelector(label: String, currentColor: Color, onColorSelected: (Color) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelSmall)
        Box(
            modifier = Modifier
                .size(32.dp)
                .background(currentColor, shape = RoundedCornerShape(4.dp))
                .border(1.dp, Color.Black, shape = RoundedCornerShape(4.dp))
                .clickable {
                    val newColor = when (currentColor) {
                        Color.Black -> Color.Blue
                        Color.Blue -> Color.Red
                        Color.Red -> Color.Green
                        Color.Green -> Color.Yellow
                        Color.Yellow -> Color.Cyan
                        Color.Cyan -> Color.Magenta
                        Color.Magenta -> Color.White
                        Color.White -> Color.Gray
                        else -> Color.Black
                    }
                    onColorSelected(newColor)
                }
        )
    }
}
