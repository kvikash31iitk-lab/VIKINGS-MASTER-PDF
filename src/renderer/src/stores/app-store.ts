/** Application shell state: theme, layout, panels, window state. */
import { create } from 'zustand';
import type { ThemeName } from '@shared/settings-schema';

export type LeftPanelId = 'thumbnails' | 'bookmarks' | 'attachments' | 'layers' | 'comments';
export type RightPanelId = 'properties' | 'formatting' | 'inspector' | 'ai';

export type RibbonTabId =
  | 'home'
  | 'edit'
  | 'review'
  | 'forms'
  | 'protect'
  | 'convert'
  | 'ocr'
  | 'organize'
  | 'esign'
  | 'view'
  | 'tools'
  | 'help';

interface AppState {
  theme: ThemeName;
  resolvedTheme: 'light' | 'dark' | 'high-contrast';
  activeRibbonTab: RibbonTabId;
  ribbonCollapsed: boolean;
  leftPanel: LeftPanelId | null;
  rightPanel: RightPanelId | null;
  leftWidth: number;
  rightWidth: number;
  statusBarVisible: boolean;
  readingMode: boolean;
  fullscreen: boolean;
  maximized: boolean;
  backstageOpen: boolean;
  commandPaletteOpen: boolean;

  setTheme(theme: ThemeName): void;
  setRibbonTab(tab: RibbonTabId): void;
  toggleRibbonCollapsed(): void;
  setLeftPanel(panel: LeftPanelId | null): void;
  setRightPanel(panel: RightPanelId | null): void;
  setLeftWidth(width: number): void;
  setRightWidth(width: number): void;
  setReadingMode(on: boolean): void;
  setWindowState(s: { maximized: boolean; fullscreen: boolean }): void;
  setBackstageOpen(open: boolean): void;
  setCommandPaletteOpen(open: boolean): void;
  setStatusBarVisible(visible: boolean): void;
}

function resolveTheme(theme: ThemeName): 'light' | 'dark' | 'high-contrast' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'system',
  resolvedTheme: resolveTheme('system'),
  activeRibbonTab: 'home',
  ribbonCollapsed: false,
  leftPanel: 'thumbnails',
  rightPanel: null,
  leftWidth: 232,
  rightWidth: 300,
  statusBarVisible: true,
  readingMode: false,
  fullscreen: false,
  maximized: false,
  backstageOpen: false,
  commandPaletteOpen: false,

  setTheme: (theme) => {
    const resolved = resolveTheme(theme);
    document.documentElement.setAttribute('data-theme', resolved);
    set({ theme, resolvedTheme: resolved });
  },
  setRibbonTab: (tab) => set({ activeRibbonTab: tab, backstageOpen: false }),
  toggleRibbonCollapsed: () => set((s) => ({ ribbonCollapsed: !s.ribbonCollapsed })),
  setLeftPanel: (panel) => set((s) => ({ leftPanel: s.leftPanel === panel ? null : panel })),
  setRightPanel: (panel) => set((s) => ({ rightPanel: s.rightPanel === panel ? null : panel })),
  setLeftWidth: (width) => set({ leftWidth: Math.max(168, Math.min(480, width)) }),
  setRightWidth: (width) => set({ rightWidth: Math.max(220, Math.min(560, width)) }),
  setReadingMode: (on) => set({ readingMode: on }),
  setWindowState: (s) => set({ maximized: s.maximized, fullscreen: s.fullscreen }),
  setBackstageOpen: (open) => set({ backstageOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setStatusBarVisible: (visible) => set({ statusBarVisible: visible })
}));

/** Re-resolve when the OS scheme flips and the user follows the system. */
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const { theme, setTheme } = useAppStore.getState();
  if (theme === 'system') setTheme('system');
});
