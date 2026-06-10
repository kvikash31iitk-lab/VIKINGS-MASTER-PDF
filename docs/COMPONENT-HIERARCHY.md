# Vikings Master PDF — Component Hierarchy

```
<App>
├── <ThemeProvider>                      applies data-theme, listens to settings
├── <ErrorBoundary>                      crash UI + report
└── <AppShell>                           layouts/AppShell.tsx
    ├── <TitleBar>                       frameless drag region
    │   ├── <AppIcon/>
    │   ├── <QuickAccessToolbar>         Save · Undo · Redo · Print
    │   ├── <DocumentTitle/>
    │   └── <WindowControls>             min / max / close
    ├── <Ribbon>
    │   ├── <RibbonTabStrip>             Home…Help + theme & settings buttons
    │   └── <RibbonContent>              groups for active tab (from ribbon definition)
    │       └── <RibbonGroup>* → <RibbonButton|Split|Dropdown|Toggle|Gallery>*
    ├── <DocumentTabStrip>               multi-document tabs + new-tab button
    ├── <WorkspaceRow>
    │   ├── <SidebarRail side=left>      icon rail (Thumbnails…Comments)
    │   ├── <LeftSidebar>  (resizable)
    │   │   ├── <ThumbnailsPanel>        virtualized, drag-reorder
    │   │   ├── <BookmarksPanel>         outline tree CRUD
    │   │   ├── <AttachmentsPanel>
    │   │   ├── <LayersPanel>            OCG toggles
    │   │   └── <CommentsPanel>          threads, replies, resolve, filter
    │   ├── <ViewerHost>
    │   │   ├── <WelcomeScreen>          when no document (recent/pinned/templates)
    │   │   ├── <PdfViewer>              per open document (kept mounted per tab)
    │   │   │   ├── <PageVirtualizer>
    │   │   │   │   └── <PageView>*      canvas + <TextLayer> + <AnnotImportLayer>
    │   │   │   │        ├── <FabricOverlay>      live annotation editing
    │   │   │   │        ├── <FormDesignerLayer>  forms mode
    │   │   │   │        ├── <RedactionLayer>     pending redaction marks
    │   │   │   │        └── <SearchHighlightLayer>
    │   │   │   ├── <FindBar>            inline Ctrl+F
    │   │   │   └── <PageNavOverlay>     floating page chip
    │   │   └── <OrganizeGrid>           page-grid mode (Organize tab)
    │   ├── <RightSidebar> (resizable)
    │   │   ├── <PropertiesPanel>        document/page/object props
    │   │   ├── <FormattingPanel>        text & shape formatting
    │   │   ├── <InspectorPanel>         object tree, metadata
    │   │   └── <AiAssistantPanel>       chat + quick actions
    │   └── <SidebarRail side=right>
    ├── <StatusBar>
    │   ├── <PageIndicator/> <ZoomControl/> <ViewModeSwitch/>
    │   ├── <OcrStatus/> <SecurityStatus/> <SaveStatus/>
    ├── <DialogHost>                     modal manager (one mounted at a time)
    │   ├── WatermarkDialog · HeaderFooterDialog · BatesDialog · StampDialog
    │   ├── EncryptDialog · PermissionsDialog · RedactDialog · SignDialog
    │   ├── OcrDialog · ConvertDialog · CompressDialog · PdfaDialog
    │   ├── SplitDialog · MergeDialog · InsertPagesDialog · CropDialog
    │   ├── CompareDialog · BatchDialog · FormFieldDialog · LinkDialog
    │   ├── PasswordPromptDialog · SaveChangesDialog · PrintDialog
    │   ├── SettingsDialog (8 categories) · ShortcutsDialog · AboutDialog
    │   └── VersionHistoryDialog · TemplatePickerDialog · SignatureManagerDialog
    ├── <CommandPalette>                 Ctrl+Shift+P fuzzy command search
    ├── <ContextMenuHost>                right-click menus
    └── <ToastHost>                      notifications + progress toasts
```

## Stores (ViewModels)

| Store            | State                                                            |
| ---------------- | ---------------------------------------------------------------- |
| `appStore`       | theme, sidebar visibility/width, active panels, layout, fullscreen |
| `documentsStore` | open documents map, active id, per-doc view state (page, zoom, mode, selections), dirty flags |
| `annotationStore`| active tool, tool options (color/width/opacity), clipboard       |
| `commentsStore`  | threads per doc, filters, resolved visibility                    |
| `searchStore`    | query, options, per-doc results, active hit                      |
| `ocrStore`       | job queue, progress, language cache state                        |
| `formsStore`     | designer mode, selected fields, grid settings                    |
| `aiStore`        | provider, conversation per doc, streaming state                  |
| `batchStore`     | job definitions, run progress, reports                           |
| `settingsStore`  | mirrored settings (synced over IPC)                              |
| `pluginStore`    | loaded plugins, contributed UI                                   |
| `dialogStore`    | open dialog id + payload                                         |
| `toastStore`     | queue                                                            |

Services are singletons resolved via `services/registry.ts`; components never call IPC
directly — always `View → Store action → Service → (core | IPC)`.
