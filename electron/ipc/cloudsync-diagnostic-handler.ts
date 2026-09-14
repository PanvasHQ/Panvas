import type { ipcMain } from 'electron';
import { sanitizeCloudDiagnostic } from '../../src/services/cloudsync/errors.js';
import { requireTrustedSender } from './security.js';

/** Renderer-to-terminal bridge for one allowlisted, content-free sync failure. */
export function registerCloudSyncDiagnosticHandler(registrar: Pick<typeof ipcMain, 'on'>): void {
  registrar.on('cloudsync:diagnostic', (event, diagnostic: unknown) => {
    requireTrustedSender(event);
    console.warn('[CloudSync diagnostic]', sanitizeCloudDiagnostic(diagnostic));
  });
}
