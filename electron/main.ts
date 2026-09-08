import path from 'path';
import { fileURLToPath } from 'url';
import { app, BrowserWindow, screen, shell, type WebContents } from 'electron';
import { isAudioOnlyMediaCheck, isAudioOnlyMediaRequest, isTrustedRendererUrl } from './security-policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main.js
// │ └─┬ preload.js
// ├─┬ dist
// │ └── index.html

process.env.APP_ROOT = path.join(__dirname, '..');

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

// Use the existing png logo for the app icon
const appIconPath = path.join(process.env.VITE_PUBLIC, 'panvas_logo.png');

let win: BrowserWindow | null;

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isTrustedAppUrl(url: string): boolean {
  return isTrustedRendererUrl(url, VITE_DEV_SERVER_URL, RENDERER_DIST);
}

function createWindow() {
  // Open at a genuinely desktop-sized fraction of the work area instead of a
  // fixed 1200x800 that reads as a small window on large displays.
  // PANVAS_TEST_WINDOW=WxH lets automated validation launch exact sizes.
  const workArea = screen.getPrimaryDisplay().workArea;
  const testBounds = /^(\d{3,5})x(\d{3,5})$/.exec(process.env.PANVAS_TEST_WINDOW ?? '');
  win = new BrowserWindow({
    width: testBounds ? Number(testBounds[1]) : Math.round(Math.min(workArea.width * 0.82, 1560)),
    height: testBounds ? Number(testBounds[2]) : Math.round(Math.min(workArea.height * 0.88, 980)),
    // Half-window layouts on 1366px laptops and tablet-sized windows must stay
    // usable: below this the responsive toolbar falls into compact mode and the
    // sidebar can no longer be compensated for by the main content area.
    minWidth: 680,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000', // Transparent overlay so native buttons blend seamlessly with any header theme
      symbolColor: '#ffffff' // corrected to the active theme by the renderer's theme sync
    },
    autoHideMenuBar: true, // Remove default Electron menu bar
    icon: appIconPath, // Configure the correct Panvas app icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: Boolean(VITE_DEV_SERVER_URL),
    },
  });

  // The shell always renders at native Chromium zoom. Chromium persists a
  // per-origin zoom in the profile, so pin it back to 1: a leftover Ctrl+/-
  // setting would otherwise corrupt responsive breakpoints and notebook
  // geometry. Panvas's document zoom is handled by the notebook viewport.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.setZoomFactor(1);
  });
  // And keep it pinned: Ctrl +/- and pinch otherwise persist shell zoom per
  // origin, which the viewport-sensitive layout cannot tolerate.
  win.webContents.on('zoom-changed', (_event, _direction) => {
    win?.webContents.setZoomFactor(1);
  });

  void win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  const isTrustedMainContents = (webContents: WebContents | null): boolean => Boolean(
    webContents && win && webContents.id === win.webContents.id && isTrustedAppUrl(webContents.getURL()),
  );
  win.webContents.session.setPermissionCheckHandler((webContents, permission, _origin, details) => {
    return isTrustedMainContents(webContents)
      && isAudioOnlyMediaCheck(permission, details.mediaType, details.isMainFrame);
  });
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined;
    const trustedRequest = isTrustedMainContents(webContents)
      && isTrustedAppUrl(details.requestingUrl)
      && isAudioOnlyMediaRequest(permission, mediaTypes, details.isMainFrame);
    callback(trustedRequest);
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedAppUrl(url)) event.preventDefault();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  destroyDiscordRpc();
});

import { registerDomainHandlers } from './ipc/domain-handlers.js';
import { registerKnowledgeHandlers } from './ipc/knowledge-handlers.js';
import { registerRecognitionHandlers } from './ipc/recognition-handlers.js';
import { registerCloudSyncHandlers } from './ipc/cloudsync-handlers.js';
import { registerCloudSyncDiagnosticHandler } from './ipc/cloudsync-diagnostic-handler.js';
import { initDiscordRpc, destroyDiscordRpc } from './discord-rpc.js';

app.whenReady().then(() => {
  registerDomainHandlers();
  registerKnowledgeHandlers();
  registerRecognitionHandlers();
  registerCloudSyncHandlers();
  registerCloudSyncDiagnosticHandler();
  initDiscordRpc();
  createWindow();
});
