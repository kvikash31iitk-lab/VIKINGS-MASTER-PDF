/**
 * Declarative ribbon model — 12 tabs of groups; items reference command ids.
 * Plugins extend this through the plugin store at render time.
 */
import type { RibbonTabId } from '../../stores/app-store';

export type RibbonItemSize = 'large' | 'small';

export interface RibbonItem {
  kind: 'command' | 'tool' | 'menu';
  commandId?: string;
  /** For tool toggles: the ToolId to compare against the active tool. */
  toolId?: string;
  label: string;
  icon: string;
  size: RibbonItemSize;
  menu?: Array<{ commandId: string; label: string; icon?: string }>;
}

export interface RibbonGroup {
  label: string;
  items: RibbonItem[];
}

export interface RibbonTab {
  id: RibbonTabId;
  label: string;
  groups: RibbonGroup[];
}

const cmd = (commandId: string, label: string, icon: string, size: RibbonItemSize = 'small'): RibbonItem => ({
  kind: 'command',
  commandId,
  label,
  icon,
  size
});

const tool = (toolId: string, label: string, icon: string, size: RibbonItemSize = 'small'): RibbonItem => ({
  kind: 'tool',
  toolId,
  commandId: `tool.${toolId}`,
  label,
  icon,
  size
});

export const RIBBON_TABS: RibbonTab[] = [
  {
    id: 'home',
    label: 'Home',
    groups: [
      {
        label: 'File',
        items: [
          cmd('file.open', 'Open', 'folder-open', 'large'),
          cmd('file.new', 'New', 'file-plus', 'large'),
          cmd('file.save', 'Save', 'save'),
          cmd('file.print', 'Print', 'print')
        ]
      },
      {
        label: 'Navigate',
        items: [
          tool('hand', 'Hand', 'hand', 'large'),
          tool('text-select', 'Select Text', 'text-cursor'),
          tool('select', 'Select', 'cursor')
        ]
      },
      {
        label: 'Zoom',
        items: [
          cmd('view.zoomOut', 'Out', 'zoom-out'),
          cmd('view.zoomIn', 'In', 'zoom-in'),
          cmd('view.fitWidth', 'Fit Width', 'fit-width'),
          cmd('view.fitPage', 'Fit Page', 'fit-page')
        ]
      },
      {
        label: 'Quick Tools',
        items: [
          tool('highlight', 'Highlight', 'highlight', 'large'),
          tool('note', 'Note', 'note'),
          cmd('ocr.run', 'OCR', 'ocr')
        ]
      },
      {
        label: 'Find',
        items: [cmd('search.find', 'Find', 'search', 'large'), cmd('ai.open', 'AI Assistant', 'ai', 'large')]
      }
    ]
  },
  {
    id: 'edit',
    label: 'Edit',
    groups: [
      {
        label: 'History',
        items: [cmd('edit.undo', 'Undo', 'rotate-left', 'large'), cmd('edit.redo', 'Redo', 'rotate-right')]
      },
      {
        label: 'Content',
        items: [
          tool('add-text', 'Add Text', 'type', 'large'),
          tool('add-image', 'Add Image', 'image', 'large'),
          tool('whiteout', 'White-out', 'whiteout'),
          tool('link', 'Link', 'link')
        ]
      },
      {
        label: 'Shapes',
        items: [
          tool('rect', 'Rectangle', 'rect-t'),
          tool('ellipse', 'Ellipse', 'ellipse-t'),
          tool('line', 'Line', 'line-t'),
          tool('arrow', 'Arrow', 'arrow-t')
        ]
      },
      {
        label: 'Pages',
        items: [cmd('organize.crop', 'Crop', 'crop-t', 'large'), cmd('organize.rotateRight', 'Rotate', 'rotate-right')]
      },
      {
        label: 'Apply',
        items: [cmd('review.commit', 'Apply Edits', 'check', 'large')]
      }
    ]
  },
  {
    id: 'review',
    label: 'Review',
    groups: [
      {
        label: 'Text Markup',
        items: [
          tool('highlight', 'Highlight', 'highlight', 'large'),
          tool('underline', 'Underline', 'underline-t'),
          tool('strikeout', 'Strikeout', 'strikeout-t'),
          tool('squiggly', 'Squiggly', 'squiggly-t')
        ]
      },
      {
        label: 'Comments',
        items: [
          tool('note', 'Sticky Note', 'note', 'large'),
          tool('textbox', 'Text Box', 'textbox-t'),
          tool('callout', 'Callout', 'callout-t')
        ]
      },
      {
        label: 'Drawing',
        items: [
          tool('pencil', 'Pencil', 'pencil', 'large'),
          tool('marker', 'Marker', 'marker'),
          tool('cloud', 'Cloud', 'cloud-t')
        ]
      },
      {
        label: 'Stamps',
        items: [cmd('tools.stamp', 'Stamps', 'stamp-t', 'large')]
      },
      {
        label: 'Review',
        items: [
          cmd('review.commit', 'Apply', 'check', 'large'),
          cmd('review.compare', 'Compare', 'compare', 'large')
        ]
      }
    ]
  },
  {
    id: 'forms',
    label: 'Forms',
    groups: [
      {
        label: 'Designer',
        items: [cmd('forms.designer', 'Form Designer', 'inspector', 'large')]
      },
      {
        label: 'Fields',
        items: [
          cmd('forms.field.text', 'Text Field', 'textbox-t'),
          cmd('forms.field.checkbox', 'Checkbox', 'check'),
          cmd('forms.field.radio', 'Radio', 'more'),
          cmd('forms.field.dropdown', 'Dropdown', 'chevron-down'),
          cmd('forms.field.listbox', 'List Box', 'reorder'),
          cmd('forms.field.date', 'Date', 'clock'),
          cmd('forms.field.signature', 'Signature', 'signature')
        ]
      },
      {
        label: 'Build',
        items: [cmd('forms.commit', 'Create Fields', 'check', 'large')]
      },
      {
        label: 'Data',
        items: [
          cmd('forms.importData', 'Import Data', 'import'),
          cmd('forms.exportData', 'Export Data', 'export'),
          cmd('forms.flatten', 'Flatten', 'compress')
        ]
      }
    ]
  },
  {
    id: 'protect',
    label: 'Protect',
    groups: [
      {
        label: 'Encrypt',
        items: [
          cmd('protect.encrypt', 'Password Protect', 'lock', 'large'),
          cmd('protect.removeSecurity', 'Remove Security', 'unlock')
        ]
      },
      {
        label: 'Redaction',
        items: [
          cmd('protect.redactMode', 'Mark Areas', 'redact', 'large'),
          cmd('protect.redact', 'Redaction Center', 'shield', 'large')
        ]
      },
      {
        label: 'Sanitize',
        items: [cmd('tools.metadata', 'Metadata', 'properties'), cmd('tools.auditLog', 'Audit Log', 'audit')]
      }
    ]
  },
  {
    id: 'convert',
    label: 'Convert',
    groups: [
      {
        label: 'Create PDF',
        items: [cmd('convert.create', 'Create PDF', 'file-plus', 'large')]
      },
      {
        label: 'Export To',
        items: [
          cmd('convert.export', 'Export', 'export', 'large'),
          cmd('file.export', 'Word / Excel / Images…', 'word')
        ]
      },
      {
        label: 'Optimize',
        items: [
          cmd('convert.compress', 'Compress', 'compress', 'large'),
          cmd('convert.pdfa', 'PDF/A', 'shield-check', 'large')
        ]
      }
    ]
  },
  {
    id: 'ocr',
    label: 'OCR',
    groups: [
      {
        label: 'Recognize',
        items: [cmd('ocr.run', 'Recognize Text', 'ocr', 'large')]
      },
      {
        label: 'Workflow',
        items: [cmd('tools.batch', 'Batch OCR', 'batch', 'large')]
      }
    ]
  },
  {
    id: 'organize',
    label: 'Organize',
    groups: [
      {
        label: 'View',
        items: [cmd('organize.mode', 'Page Grid', 'thumbnails', 'large')]
      },
      {
        label: 'Pages',
        items: [
          cmd('organize.insertBlank', 'Insert Blank', 'insert-page'),
          cmd('organize.insertFromFile', 'Insert File', 'import'),
          cmd('organize.deletePages', 'Delete', 'delete-page'),
          cmd('organize.duplicatePages', 'Duplicate', 'pages')
        ]
      },
      {
        label: 'Transform',
        items: [
          cmd('organize.rotateLeft', 'Rotate Left', 'rotate-left'),
          cmd('organize.rotateRight', 'Rotate Right', 'rotate-right'),
          cmd('organize.crop', 'Crop', 'crop-t')
        ]
      },
      {
        label: 'Documents',
        items: [
          cmd('organize.extract', 'Extract', 'extract', 'large'),
          cmd('organize.split', 'Split', 'split', 'large'),
          cmd('organize.merge', 'Merge', 'merge', 'large')
        ]
      }
    ]
  },
  {
    id: 'esign',
    label: 'eSign',
    groups: [
      {
        label: 'Sign',
        items: [
          cmd('esign.place', 'Place Signature', 'signature', 'large'),
          cmd('esign.manager', 'My Signatures', 'pencil')
        ]
      },
      {
        label: 'Certificates',
        items: [
          cmd('esign.sign', 'Certificate Sign', 'certificate', 'large'),
          cmd('esign.verify', 'Validate', 'shield-check', 'large')
        ]
      }
    ]
  },
  {
    id: 'view',
    label: 'View',
    groups: [
      {
        label: 'Page Display',
        items: [
          cmd('view.mode.continuous', 'Continuous', 'scroll'),
          cmd('view.mode.single', 'Single', 'page-single'),
          cmd('view.mode.facing', 'Facing', 'page-facing'),
          cmd('view.mode.book', 'Book', 'book')
        ]
      },
      {
        label: 'Zoom',
        items: [
          cmd('view.zoomIn', 'Zoom In', 'zoom-in'),
          cmd('view.zoomOut', 'Zoom Out', 'zoom-out'),
          cmd('view.actualSize', 'Actual Size', 'fit-page'),
          cmd('view.fitWidth', 'Fit Width', 'fit-width')
        ]
      },
      {
        label: 'Modes',
        items: [
          cmd('view.readingMode', 'Reading', 'reading', 'large'),
          cmd('view.fullscreen', 'Fullscreen', 'fullscreen', 'large')
        ]
      },
      {
        label: 'Theme',
        items: [
          cmd('view.theme.light', 'Light', 'sun'),
          cmd('view.theme.dark', 'Dark', 'moon'),
          cmd('view.theme.high-contrast', 'High Contrast', 'contrast')
        ]
      }
    ]
  },
  {
    id: 'tools',
    label: 'Tools',
    groups: [
      {
        label: 'Document',
        items: [
          cmd('tools.watermark', 'Watermark', 'watermark', 'large'),
          cmd('tools.headerFooter', 'Header & Footer', 'header-footer', 'large'),
          cmd('tools.bates', 'Bates Numbers', 'bates', 'large')
        ]
      },
      {
        label: 'Content',
        items: [
          cmd('tools.attach', 'Attach File', 'attachment'),
          cmd('tools.stamp', 'Stamps', 'stamp-t'),
          cmd('tools.metadata', 'Metadata', 'properties')
        ]
      },
      {
        label: 'Automation',
        items: [
          cmd('tools.batch', 'Batch', 'batch', 'large'),
          cmd('tools.versionHistory', 'Versions', 'history', 'large')
        ]
      },
      {
        label: 'Platform',
        items: [
          cmd('tools.plugins', 'Plugins', 'plugin'),
          cmd('tools.auditLog', 'Audit Log', 'audit'),
          cmd('tools.exportLogs', 'Export Logs', 'export')
        ]
      }
    ]
  },
  {
    id: 'help',
    label: 'Help',
    groups: [
      {
        label: 'Learn',
        items: [
          cmd('app.shortcuts', 'Shortcuts', 'keyboard', 'large'),
          cmd('app.commandPalette', 'Command Palette', 'search')
        ]
      },
      {
        label: 'Application',
        items: [
          cmd('app.settings', 'Settings', 'settings', 'large'),
          cmd('app.checkUpdates', 'Updates', 'update'),
          cmd('app.about', 'About', 'info')
        ]
      }
    ]
  }
];
