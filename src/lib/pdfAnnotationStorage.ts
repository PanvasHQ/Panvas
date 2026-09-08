const PDF_ANNOTATION_STORAGE_PATTERN = /^(.*)_pdf_([1-9][0-9]*)$/;

export interface PdfAnnotationStorageIdentity {
  ownerPageId: string;
  sourcePage: number;
}

/** Stable storage identity for one source page of a PDF notebook page. */
export function pdfAnnotationStorageId(ownerPageId: string, sourcePage: number): string {
  return `${ownerPageId}_pdf_${sourcePage}`;
}

/** Resolve a virtual PDF annotation id without changing the persisted identity. */
export function parsePdfAnnotationStorageId(value: string): PdfAnnotationStorageIdentity | null {
  const match = PDF_ANNOTATION_STORAGE_PATTERN.exec(value);
  if (!match || match[1].length === 0) return null;
  const sourcePage = Number(match[2]);
  return Number.isSafeInteger(sourcePage) ? { ownerPageId: match[1], sourcePage } : null;
}
