package com.vikingstech.masterpdf.ui.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.vikingstech.masterpdf.R
import com.vikingstech.masterpdf.domain.model.ThemeMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val isTesting by viewModel.isTesting.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    val msgOk = stringResource(R.string.settings_test_ok)
    val msgNoUrl = stringResource(R.string.settings_test_no_url)
    val msgFailFmt = stringResource(R.string.settings_test_fail)

    androidx.compose.runtime.LaunchedEffect(Unit) {
        viewModel.testResult.collect { result ->
            val text = when (result) {
                TestConnectionResult.Ok -> msgOk
                TestConnectionResult.NoUrl -> msgNoUrl
                is TestConnectionResult.Failed -> String.format(msgFailFmt, result.message)
            }
            snackbar.showSnackbar(text)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.action_settings)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back)
                        )
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbar) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
        ) {
            SectionHeader(stringResource(R.string.settings_appearance))

            ThemeMode.entries.forEach { mode ->
                ThemeRow(
                    selected = settings.themeMode == mode,
                    onSelect = { viewModel.edit { it.copy(themeMode = mode) } },
                    label = mode.label()
                )
            }

            ListItem(
                headlineContent = { Text("OLED dark mode") },
                supportingContent = { Text("True-black surfaces in dark themes") },
                trailingContent = {
                    Switch(
                        checked = settings.oledDarkMode,
                        onCheckedChange = { checked -> viewModel.edit { it.copy(oledDarkMode = checked) } }
                    )
                }
            )
            ListItem(
                headlineContent = { Text("Dynamic color") },
                supportingContent = { Text("Use the system wallpaper palette (Android 12+)") },
                trailingContent = {
                    Switch(
                        checked = settings.dynamicColor,
                        onCheckedChange = { checked -> viewModel.edit { it.copy(dynamicColor = checked) } }
                    )
                }
            )

            HorizontalDivider()
            SectionHeader(stringResource(R.string.settings_ai))

            OutlinedTextField(
                value = settings.aiBaseUrl,
                onValueChange = { value -> viewModel.edit { it.copy(aiBaseUrl = value) } },
                label = { Text("Endpoint URL") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)
            )
            OutlinedTextField(
                value = settings.aiModel,
                onValueChange = { value -> viewModel.edit { it.copy(aiModel = value) } },
                label = { Text("Model") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)
            )
            OutlinedTextField(
                value = settings.aiApiKey,
                onValueChange = { value -> viewModel.edit { it.copy(aiApiKey = value) } },
                label = { Text("API key") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)
            )

            Button(
                onClick = viewModel::testConnection,
                enabled = !isTesting,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                if (isTesting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Text(
                        text = stringResource(R.string.settings_testing),
                        modifier = Modifier.padding(start = 8.dp)
                    )
                } else {
                    Text(stringResource(R.string.settings_test_connection))
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
    )
}

@Composable
private fun ThemeRow(selected: Boolean, onSelect: () -> Unit, label: String) {
    ListItem(
        leadingContent = { RadioButton(selected = selected, onClick = onSelect) },
        headlineContent = { Text(label) },
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, onClick = onSelect)
    )
}

private fun ThemeMode.label(): String = when (this) {
    ThemeMode.LIGHT -> "Light"
    ThemeMode.DARK -> "Dark"
    ThemeMode.SYSTEM -> "Follow system"
}
