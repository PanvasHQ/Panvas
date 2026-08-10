import type { Workspace, Folder, CanvasFile } from '@/types/workspace';
import type { Notebook, NotebookSection, NotebookPage } from '@/types/notebook';

export interface PanvasDomainAPI {
  workspace: {
    create: (name: string) => Promise<Workspace>;
    open: (locationPath: string) => Promise<Workspace>;
    openDialog: () => Promise<Workspace | null>;
    getAll: () => Promise<Workspace[]>;
    update: (id: string, updates: Partial<Workspace>) => Promise<Workspace>;
    reorder: (wsId: string, type: 'folder' | 'notebook' | 'canvas' | 'section' | 'page', itemIds: string[]) => Promise<boolean>;
  };
  folder: {
    create: (wsId: string, name: string, parentId: string | null) => Promise<Folder>;
    update: (wsId: string, folderId: string, updates: Partial<Folder>) => Promise<Folder>;
    delete: (wsId: string, folderId: string) => Promise<boolean>;
    getAll: (wsId: string) => Promise<Folder[]>;
  };
  canvasFile: {
    create: (wsId: string, name: string, folderId: string | null) => Promise<CanvasFile>;
    update: (wsId: string, canvasId: string, updates: Partial<CanvasFile>) => Promise<CanvasFile>;
    delete: (wsId: string, canvasId: string) => Promise<boolean>;
    getAll: (wsId: string) => Promise<CanvasFile[]>;
  };
  canvas: {
    save: (wsId: string, canvasId: string, data: any) => Promise<void>;
    load: (wsId: string, canvasId: string) => Promise<any>;
  };
  notebook: {
    create: (wsId: string, name: string, folderId: string | null) => Promise<Notebook>;
    update: (wsId: string, notebookId: string, updates: Partial<Notebook>) => Promise<Notebook>;
    delete: (wsId: string, notebookId: string) => Promise<boolean>;
    getAll: (wsId: string) => Promise<Notebook[]>;
    savePage: (wsId: string, notebookId: string, pageId: string, data: any) => Promise<void>;
    loadPage: (wsId: string, notebookId: string, pageId: string) => Promise<any>;
    saveDrawing: (wsId: string, notebookId: string, pageId: string, drawingData: any) => Promise<void>;
    loadDrawing: (wsId: string, notebookId: string, pageId: string) => Promise<any>;
  };
  notebookSection: {
    create: (wsId: string, notebookId: string, name: string) => Promise<NotebookSection>;
    update: (wsId: string, sectionId: string, updates: Partial<NotebookSection>) => Promise<NotebookSection>;
    delete: (wsId: string, sectionId: string) => Promise<boolean>;
    getAll: (wsId: string) => Promise<NotebookSection[]>;
  };
  notebookPage: {
    create: (wsId: string, notebookId: string, sectionId: string, title: string) => Promise<NotebookPage>;
    update: (wsId: string, pageId: string, updates: Partial<NotebookPage>) => Promise<NotebookPage>;
    delete: (wsId: string, pageId: string) => Promise<boolean>;
    getAll: (wsId: string) => Promise<NotebookPage[]>;
  };
  settings: {
    get: (wsId: string | null, key: string) => Promise<any>;
    set: (wsId: string | null, key: string, value: any) => Promise<boolean>;
    setTheme: (theme: string) => Promise<void>;
  };
  migration: {
    importWorkspace: (workspaceObj: any, canvasDataList: any[]) => Promise<boolean>;
  };
}

declare global {
  interface Window {
    panvas: PanvasDomainAPI;
  }
}
