import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { isTrustedIpcSender } from '../security-policy.js';

export type TrustedSenderEvent = Pick<IpcMainInvokeEvent | IpcMainEvent, 'senderFrame'>;

/** Reject anything except the top-level Panvas renderer with a content-free error. */
// SECURITY: Hard IPC process boundary invariant.
// All IPC channels handling disk I/O, dialogs, or shell operations MUST call
// requireTrustedSender(event) to verify that event.senderFrame originates from
// the trusted local bundle (file://.../dist/) or localhost Vite dev server.
// Any untrusted frame, cross-origin webview, or injected iframe is rejected.
export function requireTrustedSender(event: TrustedSenderEvent): void {
  const rendererDirectory = path.join(process.env.APP_ROOT ?? process.cwd(), 'dist');
  if (!isTrustedIpcSender(event, process.env.VITE_DEV_SERVER_URL, rendererDirectory)) {
    throw new Error('Untrusted IPC sender.');
  }
}
