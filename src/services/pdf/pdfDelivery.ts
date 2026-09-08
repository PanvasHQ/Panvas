import type { NotebookPdfExportResult } from './notebookPdfExport';

function safePdfFileName(name: string): string {
  return `${name.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'Panvas-export'}.pdf`;
}

export function downloadPdfResult(result: NotebookPdfExportResult, fileName: string): void {
  if (!result.success || !result.bytes) throw new Error(result.error || 'PDF export failed.');
  const url = URL.createObjectURL(new Blob([result.bytes as BlobPart], { type: 'application/pdf' }));
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safePdfFileName(fileName);
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface PdfPrintTarget {
  closed: boolean;
  navigate: (url: string) => Promise<void>;
  print: () => void;
  close: () => void;
}

export interface PdfPrintRuntime {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  delay: (milliseconds: number) => Promise<void>;
  schedule: (callback: () => void, milliseconds: number) => unknown;
}

export type NativePdfPrinter = (bytes: Uint8Array) => Promise<{ status: 'printed' | 'cancelled' }>;

export type PreparedPdfPrintDelivery =
  | { kind: 'electron'; print: NativePdfPrinter }
  | { kind: 'browser'; target: PdfPrintTarget };

export interface PdfPrintDeliveryRuntime {
  nativePrint?: NativePdfPrinter;
  openBrowserTarget: () => PdfPrintTarget | null;
}

const browserPrintRuntime: PdfPrintRuntime = {
  createObjectURL: blob => URL.createObjectURL(blob),
  revokeObjectURL: url => URL.revokeObjectURL(url),
  delay: milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds)),
  schedule: (callback, milliseconds) => window.setTimeout(callback, milliseconds),
};

/** Open this synchronously from the click handler, before asynchronous PDF generation. */
export function openPdfPrintTarget(): PdfPrintTarget | null {
  const popup = window.open('', '_blank', 'popup,width=960,height=720');
  if (!popup) return null;
  popup.opener = null;
  popup.document.title = 'Preparing Panvas print…';
  const message = popup.document.createElement('p');
  message.textContent = 'Preparing your Panvas document for printing…';
  message.style.cssText = 'font: 16px system-ui; padding: 32px; color: #333';
  popup.document.body.appendChild(message);
  return {
    get closed() { return popup.closed; },
    navigate: url => new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        popup.removeEventListener('load', finish);
        resolve();
      };
      popup.addEventListener('load', finish, { once: true });
      popup.location.replace(url);
      // Chromium's built-in PDF viewer does not consistently forward `load`
      // in every Electron version. This is a fallback, not the primary wait.
      window.setTimeout(finish, 10_000);
    }),
    print: () => { popup.focus(); popup.print(); },
    close: () => popup.close(),
  };
}

/** Selects Electron without touching window.open; browser builds pre-open a tab synchronously. */
export function preparePdfPrintDelivery(runtime: PdfPrintDeliveryRuntime = {
  nativePrint: typeof window !== 'undefined' ? window.panvas?.print?.pdf : undefined,
  openBrowserTarget: openPdfPrintTarget,
}): PreparedPdfPrintDelivery | null {
  if (runtime.nativePrint) return { kind: 'electron', print: runtime.nativePrint };
  const target = runtime.openBrowserTarget();
  return target ? { kind: 'browser', target } : null;
}

export async function deliverPreparedPdf(
  bytes: Uint8Array,
  delivery: PreparedPdfPrintDelivery,
): Promise<{ status: 'printed' | 'cancelled' }> {
  if (delivery.kind === 'electron') return delivery.print(bytes);
  await printPdfBytes(bytes, delivery.target);
  return { status: 'printed' };
}

/**
 * Prints only a generated PDF surface. It never invokes print on the live app
 * window, and keeps the object URL alive long enough for Chromium's PDF viewer.
 */
export async function printPdfBytes(
  bytes: Uint8Array,
  target: PdfPrintTarget | null,
  runtime: PdfPrintRuntime = browserPrintRuntime,
): Promise<void> {
  if (!target || target.closed) throw new Error('The print window was blocked. Allow popups for Panvas and try again.');
  const url = runtime.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  let handedOff = false;
  try {
    await target.navigate(url);
    await runtime.delay(100);
    if (target.closed) throw new Error('The print window was closed before the document was ready.');
    target.print();
    handedOff = true;
    runtime.schedule(() => runtime.revokeObjectURL(url), 60_000);
  } finally {
    if (!handedOff) {
      runtime.revokeObjectURL(url);
      if (!target.closed) target.close();
    }
  }
}
