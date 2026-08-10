export type PdfAnnotationType = 'pen' | 'highlight' | 'text' | 'shape' | 'underline' | 'strike' | 'rectangle' | 'circle' | 'line';

export interface PdfAnnotation {
  id: string;
  pdfDataId: string;
  pageNumber: number;
  type: PdfAnnotationType;
  
  // All geometry MUST be stored in PDF-relative coordinates.
  // We use pdfjs-dist's unscaled Viewport or pdf point coordinate space.
  geometry: any;
  
  style?: {
    color?: string;
    lineWidth?: number;
    opacity?: number;
  };
  
  content?: string;
  
  createdAt: number;
  updatedAt: number;
  userId: string | null;
  deletedAt?: number | null;
}
