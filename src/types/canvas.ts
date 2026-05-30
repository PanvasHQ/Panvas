// ============================================
// Panvas — Type Definitions: Canvas
// ============================================
// Simplified types for MVP to avoid strict type dependencies
type ExcalidrawElement = any;
type AppState = any;
type BinaryFiles = any;

export interface CanvasData {
  canvasFileId: string;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  customBlocks: CustomBlock[];
  version: number;
  updatedAt: number;
  userId: string | null;
}

export type BlockType = 'markdown' | 'latex' | 'pdf';

export interface CustomBlock {
  id: string;
  canvasFileId: string;
  type: BlockType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string; // markdown text, LaTeX formula, or PDF data reference
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  userId: string | null;
}

export interface MarkdownBlockData extends CustomBlock {
  type: 'markdown';
}

export interface LatexBlockData extends CustomBlock {
  type: 'latex';
  metadata?: {
    displayMode?: boolean; // inline vs block
  };
}

export interface PdfBlockData extends CustomBlock {
  type: 'pdf';
  metadata?: {
    pdfDataId?: string; // reference to stored PDF
    currentPage?: number;
    totalPages?: number;
    scale?: number;
  };
}

export interface PdfFileData {
  id: string;
  canvasFileId: string;
  fileName: string;
  data: ArrayBuffer;
  createdAt: number;
  userId: string | null;
}
