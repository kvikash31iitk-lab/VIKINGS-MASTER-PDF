/**
 * Typed application settings with defaults. Stored as dot-notation keys in SQLite;
 * this module is the single authority for shape + defaults + validation.
 */

export type ThemeName = 'light' | 'dark' | 'high-contrast' | 'system';

export interface AppSettings {
  general: {
    restoreSession: boolean;
    openLastFileOnStart: boolean;
    confirmBeforeClose: boolean;
    defaultSaveDirectory: string;
    checkUpdatesAutomatically: boolean;
    language: string;
  };
  appearance: {
    theme: ThemeName;
    accentColor: string;
    uiDensity: 'comfortable' | 'compact';
    showStatusBar: boolean;
    animationsEnabled: boolean;
  };
  viewer: {
    defaultZoom: 'fit-width' | 'fit-page' | 'actual' | number;
    defaultViewMode: 'continuous' | 'single' | 'facing' | 'book';
    smoothScrolling: boolean;
    rememberLastPage: boolean;
    renderDpiCap: number;
  };
  ocr: {
    defaultLanguages: string[];
    mode: 'fast' | 'balanced' | 'accurate';
    keepOriginalAsBackup: boolean;
    tessdataPath: string;
  };
  security: {
    defaultAlgorithm: 'aes-256' | 'aes-128';
    clearClipboardOnExit: boolean;
    auditLoggingEnabled: boolean;
    redactionDpi: number;
  };
  performance: {
    hardwareAcceleration: boolean;
    workerThreads: number; // 0 = auto
    pageCacheSize: number;
    undoHistoryLimit: number;
  };
  autosave: {
    enabled: boolean;
    intervalMinutes: number;
    maxVersionsPerDocument: number;
  };
  ai: {
    provider: 'offline' | 'ollama' | 'openai-compatible';
    ollamaUrl: string;
    ollamaModel: string;
    openAiBaseUrl: string;
    openAiModel: string;
    openAiApiKey: string;
    storeHistory: boolean;
  };
  plugins: {
    enabled: boolean;
    allowList: string[];
  };
  shortcuts: Record<string, string>; // commandId → accelerator
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    restoreSession: true,
    openLastFileOnStart: false,
    confirmBeforeClose: true,
    defaultSaveDirectory: '',
    checkUpdatesAutomatically: true,
    language: 'en'
  },
  appearance: {
    theme: 'system',
    accentColor: '#2563eb',
    uiDensity: 'comfortable',
    showStatusBar: true,
    animationsEnabled: true
  },
  viewer: {
    defaultZoom: 'fit-width',
    defaultViewMode: 'continuous',
    smoothScrolling: true,
    rememberLastPage: true,
    renderDpiCap: 240
  },
  ocr: {
    defaultLanguages: ['eng'],
    mode: 'balanced',
    keepOriginalAsBackup: true,
    tessdataPath: ''
  },
  security: {
    defaultAlgorithm: 'aes-256',
    clearClipboardOnExit: false,
    auditLoggingEnabled: true,
    redactionDpi: 300
  },
  performance: {
    hardwareAcceleration: true,
    workerThreads: 0,
    pageCacheSize: 24,
    undoHistoryLimit: 30
  },
  autosave: {
    enabled: true,
    intervalMinutes: 5,
    maxVersionsPerDocument: 20
  },
  ai: {
    provider: 'offline',
    ollamaUrl: 'http://127.0.0.1:11434',
    ollamaModel: 'llama3.2',
    openAiBaseUrl: '',
    openAiModel: '',
    openAiApiKey: '',
    storeHistory: true
  },
  plugins: {
    enabled: true,
    allowList: []
  },
  shortcuts: {}
};

/** Flattens nested settings into dot-notation entries for storage. */
export function flattenSettings(obj: Record<string, unknown>, prefix = ''): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenSettings(v as Record<string, unknown>, key));
    } else {
      out.push([key, v]);
    }
  }
  return out;
}

/** Applies a dot-notation key onto a settings object (mutating clone helper). */
export function setByPath<T extends Record<string, unknown>>(target: T, path: string, value: unknown): T {
  const parts = path.split('.');
  let node: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const next = node[part];
    if (next === null || typeof next !== 'object') {
      node[part] = {};
    }
    node = node[part] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]!] = value;
  return target;
}

export function getByPath(target: Record<string, unknown>, path: string): unknown {
  let node: unknown = target;
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** Deep-merges stored values over defaults, dropping unknown keys. */
export function mergeWithDefaults(stored: Array<[string, unknown]>): AppSettings {
  const result = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
  const validKeys = new Set(flattenSettings(result).map(([k]) => k));
  for (const [key, value] of stored) {
    if (validKeys.has(key) || key.startsWith('shortcuts.')) {
      setByPath(result, key, value);
    }
  }
  return result as unknown as AppSettings;
}
