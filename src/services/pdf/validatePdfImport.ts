import { PDFDocument } from 'pdf-lib';

export const MAX_PDF_IMPORT_BYTES = 200 * 1024 * 1024;

export async function validatePdfImport(buffer: ArrayBuffer): Promise<{ pageCount: number }> {
  if (buffer.byteLength === 0) throw new Error('PDF is empty.');
  if (buffer.byteLength > MAX_PDF_IMPORT_BYTES) {
    throw new Error('PDF exceeds the supported 200 MB local import limit.');
  }

  try {
    const document = await PDFDocument.load(buffer.slice(0), { ignoreEncryption: false });
    const pageCount = document.getPageCount();
    if (pageCount < 1) throw new Error('PDF contains no pages.');
    return { pageCount };
  } catch (error) {
    throw new Error(`The selected PDF is corrupt, encrypted, or unsupported: ${error instanceof Error ? error.message : 'validation failed'}`);
  }
}
