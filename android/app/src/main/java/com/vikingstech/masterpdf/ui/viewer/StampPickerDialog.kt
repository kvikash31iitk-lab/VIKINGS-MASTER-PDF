package com.vikingstech.masterpdf.ui.viewer

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.domain.model.CustomStamp
import androidx.compose.ui.res.stringResource

/**
 * Lists the user's saved stamps to place, plus a shortcut to design a new one.
 * Selecting a stamp begins page placement.
 */
@Composable
fun StampPickerDialog(
    stamps: List<CustomStamp>,
    onSelect: (CustomStamp) -> Unit,
    onCreateNew: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.viewer_stamps)) },
        text = {
            if (stamps.isEmpty()) {
                Text(stringResource(R.string.stamp_none))
            } else {
                LazyColumn(modifier = Modifier.heightIn(max = 320.dp).fillMaxWidth()) {
                    items(stamps, key = { it.id }) { stamp ->
                        StampPickRow(stamp = stamp, onClick = { onSelect(stamp) })
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onCreateNew) { Text(stringResource(R.string.stamp_create_new)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.generic_cancel)) }
        }
    )
}

@Composable
private fun StampPickRow(stamp: CustomStamp, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = stamp.name,
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(stamp.backgroundColor, RoundedCornerShape(stamp.borderRadius.dp))
                    .border(
                        width = stamp.borderWidth.dp,
                        color = stamp.borderColor,
                        shape = RoundedCornerShape(stamp.borderRadius.dp)
                    )
                    .padding(8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = stamp.text,
                    color = stamp.textColor,
                    fontSize = stamp.fontSize.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
