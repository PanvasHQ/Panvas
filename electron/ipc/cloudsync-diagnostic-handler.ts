import { ipcMain } from 'electron';
import { sanitizeCloudDiagnostic } from '../../src/services/cloudsync/errors.js';

/** Renderer-to-terminal bridge for one allowlisted, content-free sync failure. */
export function registerCloudSyncDiagnosticHandler(): void {
  ipcMain.on('cloudsync:diagnostic', (_event, diagnostic: unknown) => {
    console.warn('[CloudSync diagnostic]', sanitizeCloudDiagnostic(diagnostic));
  });
}
