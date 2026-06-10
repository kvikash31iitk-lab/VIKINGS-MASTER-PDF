/**
 * Inline SVG icon set — original 24×24 stroke glyphs, no external icon
 * libraries. Add new icons by extending PATHS.
 */
import { memo } from 'react';

const PATHS: Record<string, string> = {
  // files & app
  'file': 'M6 2h8l5 5v15H6zM14 2v5h5',
  'file-plus': 'M6 2h8l5 5v15H6zM14 2v5h5M12 11v6M9 14h6',
  'folder-open': 'M3 7h6l2 2h10v3M3 7v13h16l3-9H6z',
  'save': 'M5 3h12l4 4v14H5zM9 3v5h7M8 14h8v7H8z',
  'print': 'M7 8V3h10v5M5 8h14a2 2 0 012 2v7h-4v4H7v-4H3v-7a2 2 0 012-2zM7 17h10',
  'share': 'M4 12v8h16v-8M12 3v12M8 7l4-4 4 4',
  'export': 'M12 3v12M8 11l4 4 4-4M4 21h16',
  'import': 'M12 15V3M8 7l4-4 4 4M4 21h16M4 15v6M20 15v6',
  'close': 'M6 6l12 12M18 6L6 18',
  'check': 'M4 13l5 5L20 7',
  'plus': 'M12 5v14M5 12h14',
  'minus': 'M5 12h14',
  'menu': 'M4 7h16M4 12h16M4 17h16',
  'more': 'M5 12h.01M12 12h.01M19 12h.01',
  'pin': 'M9 4h6l1 7 3 3H5l3-3zM12 14v7',
  'star': 'M12 3l2.7 5.8 6.3.8-4.6 4.3 1.2 6.1-5.6-3-5.6 3 1.2-6.1L3 9.6l6.3-.8z',
  'clock': 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 7v5l4 2',
  'search': 'M10.5 17a6.5 6.5 0 110-13 6.5 6.5 0 010 13zM15 15l6 6',
  'settings': 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.5-1-2 3.4 2 1.6A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.4-2.6a7 7 0 002-1.2l2.5 1 2-3.4-2-1.6a7 7 0 00.1-1.2z',
  'help': 'M12 21a9 9 0 110-18 9 9 0 010 18zM9.5 9a2.6 2.6 0 015 .9c0 1.7-2.5 2.2-2.5 3.6M12 17h.01',
  'info': 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 11v5M12 8h.01',
  // window controls
  'win-min': 'M5 12h14',
  'win-max': 'M6 6h12v12H6z',
  'win-restore': 'M8 8h10v10H8zM8 8V5h11v11h-3',
  // navigation
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M6 15l6-6 6 6',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevrons-left': 'M11 6l-6 6 6 6M18 6l-6 6 6 6',
  'chevrons-right': 'M6 6l6 6-6 6M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  // view
  'zoom-in': 'M10.5 17a6.5 6.5 0 110-13 6.5 6.5 0 010 13zM15 15l6 6M8 10.5h5M10.5 8v5',
  'zoom-out': 'M10.5 17a6.5 6.5 0 110-13 6.5 6.5 0 010 13zM15 15l6 6M8 10.5h5',
  'fit-width': 'M4 5v14M20 5v14M7 12h10M7 12l2-2M7 12l2 2M17 12l-2-2M17 12l-2 2',
  'fit-page': 'M5 4h14v16H5zM9 9h6v6H9z',
  'fullscreen': 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  'book': 'M12 5c-2-1.5-5-1.5-8 0v14c3-1.5 6-1.5 8 0 2-1.5 5-1.5 8 0V5c-3-1.5-6-1.5-8 0zM12 5v14',
  'page-single': 'M7 3h10v18H7z',
  'page-facing': 'M3 4h8v16H3zM13 4h8v16h-8z',
  'scroll': 'M7 3h10v18H7zM7 8h10M7 13h10',
  'reading': 'M4 6h16M4 10h16M4 14h10',
  'sun': 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19',
  'moon': 'M20 14.5A8 8 0 119.5 4 6.5 6.5 0 0020 14.5z',
  'contrast': 'M12 21a9 9 0 110-18 9 9 0 010 18zM12 3v18M12 3a9 9 0 010 18',
  // tools
  'hand': 'M8 12V5.5a1.5 1.5 0 013 0V11m0-5.5v-1a1.5 1.5 0 013 0V11m0-5a1.5 1.5 0 013 0V13m-9-1v7l-2.5-3a1.7 1.7 0 00-2.5 2L8 21h9c2 0 3-1.5 3-3.5V6',
  'cursor': 'M5 3l7 17 2.5-6.5L21 11z',
  'text-cursor': 'M9 4h2a2 2 0 012 2v12a2 2 0 002 2h-2a2 2 0 01-2-2V6a2 2 0 00-2-2zM13 4h2M9 20h2M15 20h-2',
  'highlight': 'M9 11l4 4L20 8l-4-4zM9 11l-4 7 1 1 7-4M4 21h16',
  'underline-t': 'M7 4v6a5 5 0 0010 0V4M5 20h14',
  'strikeout-t': 'M6 12h12M9 5h6a3 3 0 013 3M6 16a4 4 0 004 3h4',
  'squiggly-t': 'M4 17c2-2 4 2 6 0s4 2 6 0 4 2 4 0M7 4h10M12 4v9',
  'note': 'M4 4h16v12H9l-5 5zM8 8h8M8 11h5',
  'pencil': 'M4 20l1-4L17 4l3 3-12 12zM14 6l3 3',
  'marker': 'M4 20h6L20 10l-5-5L5 15zM13 7l5 5',
  'line-t': 'M5 19L19 5',
  'arrow-t': 'M5 19L19 5M19 5h-7M19 5v7',
  'rect-t': 'M4 6h16v12H4z',
  'ellipse-t': 'M12 19c-4.5 0-8-3-8-7s3.5-7 8-7 8 3 8 7-3.5 7-8 7z',
  'cloud-t': 'M7 18a4 4 0 01-.5-8 5.5 5.5 0 0110.6-1.5A4.5 4.5 0 0117 18z',
  'callout-t': 'M8 6h12v9h-7l-3 3v-3H8zM3 21l5-6',
  'textbox-t': 'M4 5h16v14H4zM8 9h8M12 9v7',
  'type': 'M5 6V4h14v2M12 4v16M9 20h6',
  'image': 'M4 5h16v14H4zM8 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 17l5-5 4 4 3-3 4 4',
  'whiteout': 'M4 14L14 4l6 6L10 20H4zM12 6l6 6',
  'link': 'M9 15l6-6M7.5 12.5l-2 2a3.5 3.5 0 005 5l2-2M16.5 11.5l2-2a3.5 3.5 0 00-5-5l-2 2',
  'stamp-t': 'M9 10c-1.5-3 0-6 3-6s4.5 3 3 6c-.7 1.3-1 2-1 3h-4c0-1-.3-1.7-1-3zM5 17c0-2 2-4 5-4h4c3 0 5 2 5 4zM5 20h14',
  'signature': 'M3 17c3 0 3-8 6-8s1 10 4 10 2-6 5-6M3 21h18',
  'redact': 'M4 5h16v6H4zM4 15h7M4 19h10M15 15l6 6M21 15l-6 6',
  'crop-t': 'M7 3v14h14M3 7h14v14',
  'eraser': 'M5 16L14 7l5 5-7 7H8zM8 19h13',
  // organize
  'pages': 'M8 3h12v14M4 7h12v14H4z',
  'insert-page': 'M8 3h12v14M4 7h12v14H4zM10 12v6M7 15h6',
  'delete-page': 'M8 3h12v14M4 7h12v14H4zM7 15h6',
  'rotate-left': 'M5 5v5h5M5 10a8 8 0 102-5.3',
  'rotate-right': 'M19 5v5h-5M19 10a8 8 0 10-2-5.3',
  'extract': 'M8 3h12v14M4 7h12v14H4zM10 11v6M7 14l3 3 3-3',
  'split': 'M4 4h7v16H4zM13 4h7v16h-7M9 12h6',
  'merge': 'M5 4h6v16H5zM13 4h6v16h-6zM2 12h20',
  'reorder': 'M7 4h10M7 9h10M7 14h10M7 19h10M4 4h.01M4 9h.01M4 14h.01M4 19h.01',
  // protect / sign
  'lock': 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3M12 15v2',
  'unlock': 'M6 11h12v9H6zM8 11V8a4 4 0 017.8-1.2M12 15v2',
  'shield': 'M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z',
  'shield-check': 'M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6zM9 12l2 2 4-4',
  'certificate': 'M4 4h16v12H4zM8 8h8M8 11h5M14 16l1.5 5 1.5-2 2.5 1-1.5-5',
  'key': 'M14 11a4 4 0 10-4 4l1-1v2h2v2h2v2h3v-3l-5-5z',
  // convert / ocr / ai
  'convert': 'M8 5h12v8M16 9l4-4-4-4M16 19H4v-8M8 15l-4 4 4 4',
  'word': 'M6 2h8l5 5v15H6zM9 12l1.5 6L12 13l1.5 5L15 12',
  'excel': 'M6 2h8l5 5v15H6zM9 12l6 6M15 12l-6 6',
  'ppt': 'M6 2h8l5 5v15H6zM9 18v-6h3a2 2 0 110 4H9',
  'html': 'M9 8l-4 4 4 4M15 8l4 4-4 4',
  'compress': 'M7 3v6H3M17 3v6h4M7 21v-6H3M17 21v-6h4',
  'ocr': 'M4 8V4h4M16 4h4v4M4 16v4h4M16 20h4v-4M8 12h8M12 8v8',
  'scan-text': 'M4 8V4h4M16 4h4v4M4 16v4h4M16 20h4v-4M8 9h8M8 12h8M8 15h5',
  'ai': 'M12 3l1.8 4.7L18 9.5l-4.2 1.8L12 16l-1.8-4.7L6 9.5l4.2-1.8zM19 15l.9 2.3L22 18l-2.1.8L19 21l-.9-2.2L16 18l2.1-.7zM5 15l.9 2.3L8 18l-2.1.8L5 21l-.9-2.2L2 18l2.1-.7z',
  'summarize': 'M5 4h14M5 8h14M5 12h9M5 16h6M14 15l2 2 4-4',
  'bulb': 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0012 3z',
  // panels
  'thumbnails': 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  'bookmark': 'M7 3h10v18l-5-4-5 4z',
  'attachment': 'M8 12l6-6a3 3 0 014 4l-8 8a5 5 0 01-7-7l8-8',
  'layers': 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  'comment': 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  'comments': 'M3 5h12v8H7l-4 3zM15 9h6v8l-3-2h-6v-3',
  'properties': 'M4 6h16M4 12h16M4 18h10M17 16v4M15 18h4',
  'inspector': 'M4 4h16v16H4zM4 9h16M9 9v11',
  'formatting': 'M6 4h12M9 4l-3 16M15 4l-3 16M5 20h12',
  // misc
  'watermark': 'M12 3c3 4.5 6 7.5 6 11a6 6 0 11-12 0c0-3.5 3-6.5 6-11zM9 14a3 3 0 003 3',
  'header-footer': 'M4 3h16v4H4zM4 17h16v4H4zM8 11h8M8 14h5',
  'bates': 'M4 5h16v14H4zM8 9v6M8 9h3a1.5 1.5 0 010 3H8M14 15v-6l2 2 2-2v6',
  'history': 'M4 5v5h5M4 10a8 8 0 102-5.3M12 8v5l3 2',
  'batch': 'M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4',
  'plugin': 'M9 4v4H5v4h4v4h4v-4h4V8h-4V4z',
  'keyboard': 'M3 7h18v10H3zM6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10',
  'compare': 'M12 3v18M4 7h5v10H4zM15 7h5v10h-5z',
  'audit': 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4',
  'update': 'M12 3v9M8 8l4-4 4 4M5 14a7 7 0 0014 0',
  'warning': 'M12 4l9 16H3zM12 10v4M12 17h.01',
  'error-circle': 'M12 21a9 9 0 110-18 9 9 0 010 18zM9 9l6 6M15 9l-6 6',
  'spinner': 'M12 3a9 9 0 019 9'
};

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export const Icon = memo(function Icon({ name, size = 16, className, strokeWidth = 1.7 }: IconProps) {
  const d = PATHS[name] ?? PATHS.file!;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
});

export const iconExists = (name: string): boolean => name in PATHS;
