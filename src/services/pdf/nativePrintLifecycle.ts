export interface NativePdfPrintResult {
  status: 'printed' | 'cancelled';
}

export interface NativePdfPrintWindow {
  loadFile: (filePath: string) => Promise<void>;
  showInactive: () => void;
  isDestroyed: () => boolean;
  destroy: () => void;
  webContents: {
    print: (
      options: { silent: false; printBackground: true },
      callback: (success: boolean, failureReason: string) => void,
    ) => void;
  };
}

export interface NativePdfPrintLifecycle {
  createTemporaryPdf: (bytes: Uint8Array) => Promise<{ filePath: string; cleanup: () => Promise<void> }>;
  createPrintWindow: () => NativePdfPrintWindow;
}

/**
 * Owns the complete lifetime of one generated-PDF print job. The caller never
 * receives a path or BrowserWindow, and cleanup runs after print, cancellation,
 * load failure, or print failure.
 */
export async function runNativePdfPrint(
  bytes: Uint8Array,
  lifecycle: NativePdfPrintLifecycle,
): Promise<NativePdfPrintResult> {
  const temporary = await lifecycle.createTemporaryPdf(bytes);
  const printWindow = lifecycle.createPrintWindow();
  try {
    await printWindow.loadFile(temporary.filePath);
    // On Windows a print dialog owned by a fully hidden BrowserWindow can stay
    // inaccessible and never complete. Show only the isolated generated-PDF
    // surface (never the Panvas DOM) immediately before native printing.
    printWindow.showInactive();
    return await new Promise<NativePdfPrintResult>((resolve, reject) => {
      printWindow.webContents.print(
        { silent: false, printBackground: true },
        (success, failureReason) => {
          if (success) {
            resolve({ status: 'printed' });
            return;
          }
          if (/cancel(?:led|ed)/i.test(failureReason)) {
            resolve({ status: 'cancelled' });
            return;
          }
          reject(new Error(failureReason || 'The system print dialog could not be opened.'));
        },
      );
    });
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy();
    await temporary.cleanup();
  }
}
