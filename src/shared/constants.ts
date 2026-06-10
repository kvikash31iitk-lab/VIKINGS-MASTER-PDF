export const APP_NAME = 'Vikings Master PDF';
export const COMPANY = 'Vikings Technologies';
export const TAGLINE = 'Professional PDF Editing Without Limits';
export const APP_ID = 'com.vikingstech.masterpdf';

export const PDF_FILTERS = [{ name: 'PDF Documents', extensions: ['pdf'] }];

export const IMAGE_FILTERS = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'tif', 'tiff'] }
];

export const OFFICE_FILTERS = [
  { name: 'Office Documents', extensions: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'] }
];

export const ZOOM_LEVELS = [
  0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4, 8, 16, 32, 64
] as const;

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 64;

export const OCR_LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: 'hin', label: 'Hindi' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'spa', label: 'Spanish' },
  { code: 'chi_sim', label: 'Chinese (Simplified)' },
  { code: 'jpn', label: 'Japanese' }
] as const;

/** Built-in redaction patterns (pattern redaction module). */
export const REDACTION_PATTERNS = [
  {
    id: 'email',
    label: 'Email Addresses',
    regex: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'
  },
  {
    id: 'phone',
    label: 'Phone Numbers',
    regex: '(?:\\+?\\d{1,3}[-.\\s]?)?(?:\\(\\d{2,4}\\)[-.\\s]?)?\\d{3,5}[-.\\s]?\\d{4,6}\\b'
  },
  {
    id: 'aadhaar',
    label: 'Aadhaar Numbers',
    regex: '\\b[2-9]\\d{3}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b'
  },
  {
    id: 'pan',
    label: 'PAN Numbers',
    regex: '\\b[A-Z]{5}\\d{4}[A-Z]\\b'
  },
  {
    id: 'credit-card',
    label: 'Credit Cards',
    regex: '\\b(?:\\d[\\s-]?){13,19}\\b',
    postValidate: 'luhn'
  }
] as const;

export const BUILT_IN_STAMPS = [
  { id: 'approved', text: 'APPROVED', color: '#107c10' },
  { id: 'draft', text: 'DRAFT', color: '#605e5c' },
  { id: 'confidential', text: 'CONFIDENTIAL', color: '#d13438' },
  { id: 'final', text: 'FINAL', color: '#2563eb' },
  { id: 'paid', text: 'PAID', color: '#107c10' }
] as const;

export const AUTOSAVE_DIR = 'versions';
export const PLUGINS_DIR = 'plugins';
export const TESSDATA_DIR = 'tessdata';
export const LOGS_DIR = 'logs';
