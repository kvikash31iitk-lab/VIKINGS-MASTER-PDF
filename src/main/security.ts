/**
 * Session hardening: CSP response headers, permission denial, and
 * navigation lockdown for every WebContents.
 */
import { app, session } from 'electron';

const CSP = [
  "default-src 'self'",
  // Tailwind injects inline styles; PDF.js and Fabric use blob/data URIs for
  // canvases, fonts and workers.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');

export function hardenSessions(): void {
  app.on('web-contents-created', (_event, contents) => {
    // Block all navigation away from the application shell.
    contents.on('will-navigate', (event, url) => {
      const allowed =
        url.startsWith('file://') ||
        (process.env.ELECTRON_RENDERER_URL !== undefined &&
          url.startsWith(process.env.ELECTRON_RENDERER_URL));
      if (!allowed) event.preventDefault();
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  // Deny every permission request (camera, geolocation, notifications, …).
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });

  // Apply CSP in packaged builds (dev server sends its own headers and the
  // meta tag in index.html covers both).
  if (!process.env.ELECTRON_RENDERER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [CSP]
        }
      });
    });
  }
}
