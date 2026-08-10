export interface Notebook {
  id: string;
  workspaceId: string;
  folderId: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
  order: number;
  isExpanded: boolean;
  userId: string | null;
}

export interface NotebookSection {
  id: string;
  notebookId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  order: number;
  isExpanded: boolean;
  userId: string | null;
}

export interface NotebookPage {
  id: string;
  notebookId: string;
  sectionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  order: number;
  userId: string | null;
  deletedAt?: number | null;
  type?: 'default' | 'pdf';
  pdfDataId?: string;
}
