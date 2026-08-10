// ============================================
// Panvas — Workspace Store (Zustand)
// Uses Repository layer for all operations
// ============================================

import { create } from 'zustand';
import type { Workspace, Folder, CanvasFile } from '@/types/workspace';
import type { Notebook, NotebookPage, NotebookSection } from '@/types/notebook';
import { workspaceRepository } from '@/repositories/WorkspaceRepository';
import { folderRepository } from '@/repositories/FolderRepository';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { notebookRepository } from '@/repositories/NotebookRepository';
import { useAuthStore } from './authStore';
import { useSyncStore } from './syncStore';
import { useNotebookSettingsStore } from './notebookSettingsStore';
import { createDefaultDrawingData } from '@/components/notebook/engine/drawingTypes';

const ACTIVE_WORKSPACE_KEY = 'panvas.activeWorkspaceId';
const ACTIVE_CANVAS_KEY = 'panvas.activeCanvasId';
const ACTIVE_PAGE_KEY = 'panvas.activePageId';

function readStoredId(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredId(key: string, value: string | null): void {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

interface WorkspaceState {
  // Data
  workspaces: Workspace[];
  folders: Folder[];
  canvasFiles: CanvasFile[];
  notebooks: Notebook[];
  notebookSections: NotebookSection[];
  notebookPages: NotebookPage[];
  recentFiles: CanvasFile[];
  
  // Trash
  deletedWorkspaces: Workspace[];
  deletedFolders: Folder[];
  deletedCanvases: CanvasFile[];

  // Selection
  activeWorkspaceId: string | null;
  activeCanvasId: string | null;
  activePageId: string | null;
  activeNotebookId: string | null;
  activeNotebookSectionId: string | null;
  expandedWorkspaceIds: Set<string>;

  // Loading
  isLoading: boolean;

  // Actions
  loadWorkspaces: () => Promise<void>;
  loadWorkspaceContents: (workspaceId: string) => Promise<void>;
  loadRecentFiles: () => Promise<void>;
  setActiveWorkspace: (id: string | null) => void;
  setActiveCanvas: (id: string | null) => void;
  setActivePage: (id: string | null) => void;
  setActiveNotebook: (id: string | null) => void;
  setActiveNotebookSection: (id: string | null) => void;
  toggleWorkspaceExpanded: (id: string) => void;
  expandWorkspace: (id: string) => void;
  reset: () => void;
  
  // Trash Actions
  loadTrash: () => Promise<void>;
  restoreItem: (id: string, type: 'workspace' | 'folder' | 'canvas') => Promise<void>;
  permanentlyDeleteItem: (id: string, type: 'workspace' | 'folder' | 'canvas') => Promise<void>;

  // CRUD
  createWorkspace: (name: string) => Promise<Workspace>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  togglePinWorkspace: (id: string) => Promise<void>;

  createFolder: (parentId: string | null, name: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  toggleFolderExpanded: (id: string) => Promise<void>;
  moveFolder: (id: string, newWorkspaceId: string, newParentId?: string | null) => Promise<void>;

  createCanvas: (folderId: string | null, name: string) => Promise<CanvasFile>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;
  togglePinCanvas: (id: string) => Promise<void>;
  duplicateCanvas: (id: string) => Promise<CanvasFile | null>;
  moveCanvas: (id: string, newWorkspaceId: string, newFolderId: string | null) => Promise<void>;

  createNotebook: (folderId: string | null, name: string) => Promise<Notebook>;
  createNotebookSection: (notebookId: string, name: string) => Promise<NotebookSection>;
  createNotebookPage: (sectionId: string, title: string) => Promise<NotebookPage>;
  reorderPages: (itemIds: string[]) => Promise<void>;
  toggleNotebookExpanded: (id: string) => Promise<void>;
  toggleNotebookSectionExpanded: (id: string) => Promise<void>;
  renameNotebook: (id: string, name: string) => Promise<void>;
  renameNotebookSection: (id: string, name: string) => Promise<void>;
  renameNotebookPage: (id: string, title: string) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  deleteNotebookSection: (id: string) => Promise<void>;
  deleteNotebookPage: (id: string) => Promise<void>;
  moveNotebook: (id: string, newWorkspaceId: string, newFolderId: string | null) => Promise<void>;
  moveNotebookSection: (id: string, newWorkspaceId: string, newNotebookId: string) => Promise<void>;
  moveNotebookPage: (id: string, newWorkspaceId: string, newSectionId: string) => Promise<void>;
  reorderItems: (type: 'folder' | 'notebook' | 'canvas' | 'section' | 'page', itemIds: string[]) => Promise<void>;
}

function getExpandedWorkspaces(): Set<string> {
  try {
    const stored = window.localStorage.getItem('panvas.expandedWorkspaces');
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

function saveExpandedWorkspaces(set: Set<string>) {
  try {
    window.localStorage.setItem('panvas.expandedWorkspaces', JSON.stringify(Array.from(set)));
  } catch {}
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  folders: [],
  canvasFiles: [],
  notebooks: [],
  notebookSections: [],
  notebookPages: [],
  recentFiles: [],
  deletedWorkspaces: [],
  deletedFolders: [],
  deletedCanvases: [],
  activeWorkspaceId: null,
  activeCanvasId: null,
  activePageId: null,
  activeNotebookId: null,
  activeNotebookSectionId: null,
  expandedWorkspaceIds: getExpandedWorkspaces(),
  isLoading: true,

  reset: () => {
    set({
      workspaces: [],
      folders: [],
      canvasFiles: [],
      notebooks: [],
      notebookSections: [],
      notebookPages: [],
      recentFiles: [],
      deletedWorkspaces: [],
      deletedFolders: [],
      deletedCanvases: [],
      activeWorkspaceId: null,
      activeCanvasId: null,
      activePageId: null,
      activeNotebookId: null,
      activeNotebookSectionId: null,
      expandedWorkspaceIds: new Set(),
      isLoading: true,
    });
  },

  loadWorkspaces: async () => {
    set({ isLoading: true });
    const userId = useAuthStore.getState().user?.id ?? null;
    const workspaces = await workspaceRepository.getAll(userId);
    
    // Preload ALL folders and canvases instantly
    const folders = await folderRepository.getAll(userId);
    const canvasFiles = await canvasRepository.getAll(userId);
    const notebooks = await notebookRepository.getAll(userId);
    const notebookSections = await notebookRepository.getSections(userId);
    const notebookPages = await notebookRepository.getPages(userId);
    
    set({ workspaces, folders, canvasFiles, notebooks, notebookSections, notebookPages, isLoading: false });

    // Restore previous workspace if available, otherwise select the first one.
    if (!get().activeWorkspaceId && workspaces.length > 0) {
      const storedWorkspaceId = readStoredId(ACTIVE_WORKSPACE_KEY);
      const restoredWorkspace = workspaces.find(ws => ws.id === storedWorkspaceId);
      const newActiveId = restoredWorkspace?.id ?? workspaces[0].id;
      get().setActiveWorkspace(newActiveId);
      get().expandWorkspace(newActiveId);
    }
  },

  loadWorkspaceContents: async (workspaceId: string) => {
    // With global loading, this is mostly just triggering active canvas checks
    // We still load specific to be safe on explicit transitions, but global load handles the main tree
    const userId = useAuthStore.getState().user?.id ?? null;
    const folders = await folderRepository.getAll(userId);
    const canvasFiles = await canvasRepository.getAll(userId);
    const notebooks = await notebookRepository.getAll(userId);
    const notebookSections = await notebookRepository.getSections(userId);
    const notebookPages = await notebookRepository.getPages(userId);
    set({ folders, canvasFiles, notebooks, notebookSections, notebookPages });

    const storedCanvasId = readStoredId(ACTIVE_CANVAS_KEY);
    const activeCanvasId = get().activeCanvasId;

    if (!activeCanvasId && storedCanvasId && canvasFiles.some(canvas => canvas.id === storedCanvasId)) {
      get().setActiveCanvas(storedCanvasId);
    }
  },

  loadRecentFiles: async () => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const recentFiles = await canvasRepository.getRecent(userId, 8);
    set({ recentFiles });

    if (!get().activeCanvasId) {
      const storedCanvasId = readStoredId(ACTIVE_CANVAS_KEY);
      const canvasToRestore = recentFiles.find(canvas => canvas.id === storedCanvasId) ?? recentFiles[0];

      if (canvasToRestore) {
        get().setActiveCanvas(canvasToRestore.id);
      }
    }
  },

  setActiveWorkspace: (id: string | null) => {
    set({ activeWorkspaceId: id });
    writeStoredId(ACTIVE_WORKSPACE_KEY, id);
    if (id) {
      get().loadWorkspaceContents(id);
    }
  },

  expandWorkspace: (id: string) => {
    set(state => {
      const nextSet = new Set(state.expandedWorkspaceIds);
      nextSet.add(id);
      saveExpandedWorkspaces(nextSet);
      return { expandedWorkspaceIds: nextSet };
    });
  },

  toggleWorkspaceExpanded: (id: string) => {
    set(state => {
      const nextSet = new Set(state.expandedWorkspaceIds);
      if (nextSet.has(id)) {
        // If it's the active workspace, we might not want to let them collapse it,
        // but Notion lets you collapse everything. Let's just toggle.
        nextSet.delete(id);
      } else {
        nextSet.add(id);
      }
      saveExpandedWorkspaces(nextSet);
      return { expandedWorkspaceIds: nextSet };
    });
  },

  setActiveCanvas: (id: string | null) => {
    const previousWorkspaceId = get().activeWorkspaceId;
    const canvas = id
      ? get().canvasFiles.find(c => c.id === id) ?? get().recentFiles.find(c => c.id === id)
      : null;

    set({
      activeCanvasId: id,
      activePageId: null,
      activeNotebookId: null,
      activeWorkspaceId: canvas?.workspaceId ?? get().activeWorkspaceId,
    });
    writeStoredId(ACTIVE_CANVAS_KEY, id);

    if (canvas?.workspaceId && canvas.workspaceId !== previousWorkspaceId) {
      writeStoredId(ACTIVE_WORKSPACE_KEY, canvas.workspaceId);
      get().loadWorkspaceContents(canvas.workspaceId);
    }

    if (id) {
      canvasRepository.updateLastOpened(id).then(() => {
        get().loadRecentFiles();
      });
    }
  },

  setActivePage: (id: string | null) => {
    const page = id ? get().notebookPages.find(item => item.id === id) : null;
    const notebook = page ? get().notebooks.find(item => item.id === page.notebookId) : null;

    set({
      activePageId: id,
      activeCanvasId: null,
      activeNotebookId: notebook?.id ?? get().activeNotebookId,
      activeNotebookSectionId: page?.sectionId ?? get().activeNotebookSectionId,
      activeWorkspaceId: notebook?.workspaceId ?? get().activeWorkspaceId,
    });
    writeStoredId(ACTIVE_PAGE_KEY, id);
    writeStoredId(ACTIVE_CANVAS_KEY, null);
  },

  setActiveNotebook: async (id: string | null) => {
    if (!id) {
      set({ activeNotebookId: null, activeNotebookSectionId: null });
      return;
    }
    set({ activeNotebookId: id, activeNotebookSectionId: null });
    let sections = get().notebookSections.filter(s => s.notebookId === id);
    let pages = get().notebookPages.filter(p => p.notebookId === id);
    
    if (pages.length > 0) {
      get().setActivePage(pages[0].id);
    }
  },

  setActiveNotebookSection: async (id: string | null) => {
    if (!id) {
      set({ activeNotebookSectionId: null });
      return;
    }
    const section = get().notebookSections.find(item => item.id === id);
    set({ activeNotebookSectionId: id, activeNotebookId: section?.notebookId ?? get().activeNotebookId });
    let pages = get().notebookPages.filter(p => p.sectionId === id);
    if (pages.length > 0) {
      get().setActivePage(pages[0].id);
    }
  },

  // ---- Trash Actions ----
  loadTrash: async () => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const { workspaces, folders, canvasFiles } = await import('@/database/workspaceDB').then(m => m.getDeletedItems(userId));
    set({
      deletedWorkspaces: workspaces,
      deletedFolders: folders,
      deletedCanvases: canvasFiles
    });
  },

  restoreItem: async (id: string, type: 'workspace' | 'folder' | 'canvas') => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const wsId = get().activeWorkspaceId;
    if (type === 'workspace') {
      await workspaceRepository.restore(userId, id);
      await get().loadWorkspaces();
    } else if (type === 'folder' && wsId) {
      await folderRepository.restore(userId, wsId, id);
      await get().loadWorkspaceContents(wsId);
    } else if (type === 'canvas' && wsId) {
      await canvasRepository.restore(wsId, id);
      await get().loadWorkspaceContents(wsId);
      await get().loadRecentFiles();
    }
    useSyncStore.getState().incrementPending();
    await get().loadTrash();
  },

  permanentlyDeleteItem: async (id: string, type: 'workspace' | 'folder' | 'canvas') => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const wsId = get().activeWorkspaceId;
    if (type === 'workspace') {
      await workspaceRepository.permanentlyDelete(id);
    } else if (type === 'folder' && wsId) {
      await folderRepository.permanentlyDelete(userId, wsId, id);
    } else if (type === 'canvas' && wsId) {
      await canvasRepository.permanentlyDelete(wsId, id);
    }
    await get().loadTrash();
  },

  // ---- CRUD: Workspaces ----
  createWorkspace: async (name: string) => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const workspace = await workspaceRepository.create(userId, name);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaces();
    return workspace;
  },

  renameWorkspace: async (id: string, name: string) => {
    const userId = useAuthStore.getState().user?.id ?? null;
    await workspaceRepository.rename(userId, id, name);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaces();
  },

  deleteWorkspace: async (id: string) => {
    await workspaceRepository.delete(id);
    useSyncStore.getState().incrementPending();
    if (get().activeWorkspaceId === id) {
      set({ activeWorkspaceId: null, activeCanvasId: null });
      writeStoredId(ACTIVE_WORKSPACE_KEY, null);
      writeStoredId(ACTIVE_CANVAS_KEY, null);
    }
    await get().loadWorkspaces();
    await get().loadTrash();
  },

  togglePinWorkspace: async (id: string) => {
    const userId = useAuthStore.getState().user?.id ?? null;
    await workspaceRepository.togglePin(userId, id);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaces();
  },

  // ---- CRUD: Folders ----
  createFolder: async (parentId: string | null, name: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) throw new Error('No active workspace');
    const userId = useAuthStore.getState().user?.id ?? null;
    const folder = await folderRepository.create(userId, wsId, parentId, name);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaceContents(wsId);
    return folder;
  },

  renameFolder: async (id: string, name: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    const userId = useAuthStore.getState().user?.id ?? null;
    await folderRepository.rename(userId, wsId, id, name);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaceContents(wsId);
  },

  deleteFolder: async (id: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    const userId = useAuthStore.getState().user?.id ?? null;
    await folderRepository.delete(userId, wsId, id);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaceContents(wsId);
    await get().loadTrash();
  },

  toggleFolderExpanded: async (id: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    const folder = get().folders.find(f => f.id === id);
    if (!folder) return;
    await folderRepository.toggleExpanded(wsId, id, !folder.isExpanded);
    await get().loadWorkspaceContents(wsId);
  },

  moveFolder: async (id: string, newWorkspaceId: string, newParentId: string | null = null) => {
    const userId = useAuthStore.getState().user?.id ?? null;
    await folderRepository.move(userId, id, newWorkspaceId, newParentId);
    useSyncStore.getState().incrementPending();
    const currentWsId = get().activeWorkspaceId;
    if (currentWsId) await get().loadWorkspaceContents(currentWsId);
  },

  // ---- CRUD: Canvases ----
  createCanvas: async (folderId: string | null, name: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) throw new Error('No active workspace');
    const userId = useAuthStore.getState().user?.id ?? null;
    const canvas = await canvasRepository.create(userId, wsId, folderId, name);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaceContents(wsId);
    await get().loadRecentFiles();
    return canvas;
  },

  renameCanvas: async (id: string, name: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    const userId = useAuthStore.getState().user?.id ?? null;
    await canvasRepository.rename(userId, wsId, id, name);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaceContents(wsId);
  },

  deleteCanvas: async (id: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    await canvasRepository.delete(wsId, id);
    useSyncStore.getState().incrementPending();
    if (get().activeCanvasId === id) {
      set({ activeCanvasId: null });
      writeStoredId(ACTIVE_CANVAS_KEY, null);
    }
    await get().loadWorkspaceContents(wsId);
    await get().loadRecentFiles();
    await get().loadTrash();
  },

  togglePinCanvas: async (id: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    const canvas = get().canvasFiles.find(c => c.id === id);
    if (!canvas) return;
    await canvasRepository.togglePin(wsId, id, !canvas.isPinned);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaceContents(wsId);
  },

  duplicateCanvas: async (id: string) => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const canvas = await canvasRepository.duplicate(userId, id);
    useSyncStore.getState().incrementPending();
    const wsId = get().activeWorkspaceId;
    if (wsId) await get().loadWorkspaceContents(wsId);
    await get().loadRecentFiles();
    return canvas;
  },

  moveCanvas: async (id: string, newWorkspaceId: string, newFolderId: string | null) => {
    const userId = useAuthStore.getState().user?.id ?? null;
    await canvasRepository.move(userId, id, newWorkspaceId, newFolderId);
    useSyncStore.getState().incrementPending();
    const wsId = get().activeWorkspaceId;
    if (wsId) await get().loadWorkspaceContents(wsId);
    await get().loadRecentFiles();
  },

  // ---- Notebook foundation ----
  createNotebook: async (folderId: string | null, name: string) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) throw new Error('No active workspace');
    const userId = useAuthStore.getState().user?.id ?? null;
    const notebook = await notebookRepository.create(userId, workspaceId, folderId, name);
    await get().loadWorkspaceContents(workspaceId);
    return notebook;
  },

  createNotebookSection: async (notebookId: string, name: string) => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) throw new Error('No active workspace');
    const section = await notebookRepository.createSection(userId, workspaceId, notebookId, name);
    await get().loadWorkspaceContents(workspaceId);
    return section;
  },

  createNotebookPage: async (sectionId: string, title: string) => {
    const section = get().notebookSections.find(item => item.id === sectionId);
    if (!section) throw new Error('Notebook section not found');
    const userId = useAuthStore.getState().user?.id ?? null;
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) throw new Error('No active workspace');
    const page = await notebookRepository.createPage(userId, workspaceId, section.notebookId, sectionId, title);
    
    // Immediately initialize with canonical default settings to avoid black/missing page contents
    const defaultSettings = useNotebookSettingsStore.getState();
    const defaultData = createDefaultDrawingData({
      paperColor: defaultSettings.paperColor,
      template: defaultSettings.template,
      orientation: defaultSettings.orientation as any,
      pageSize: defaultSettings.pageSize,
      margins: defaultSettings.margins
    });
    await notebookRepository.saveDrawingData(workspaceId, section.notebookId, page.id, defaultData);

    if (workspaceId) await get().loadWorkspaceContents(workspaceId);
    get().setActivePage(page.id);
    return page;
  },

  reorderPages: async (itemIds: string[]) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    
    set(state => {
      const newPages = [...state.notebookPages];
      itemIds.forEach((id, index) => {
        const page = newPages.find(p => p.id === id);
        if (page) page.order = index;
      });
      return { notebookPages: newPages };
    });
    
    await workspaceRepository.reorderItems(wsId, 'page', itemIds);
    await get().loadWorkspaceContents(wsId);
  },

  toggleNotebookExpanded: async (id: string) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) return;
    const notebook = get().notebooks.find(n => n.id === id);
    if (!notebook) return;
    await notebookRepository.toggleExpanded(workspaceId, id, !notebook.isExpanded);
    await get().loadWorkspaceContents(workspaceId);
  },

  toggleNotebookSectionExpanded: async (id: string) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) return;
    const section = get().notebookSections.find(s => s.id === id);
    if (!section) return;
    await notebookRepository.toggleSectionExpanded(workspaceId, id, !section.isExpanded);
    await get().loadWorkspaceContents(workspaceId);
  },

  renameNotebook: async (id: string, name: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    await notebookRepository.rename(wsId, id, name);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaceContents(wsId);
  },
  renameNotebookSection: async (id: string, name: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    await notebookRepository.renameSection(wsId, id, name);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaceContents(wsId);
  },
  renameNotebookPage: async (id: string, title: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    await notebookRepository.renamePage(wsId, id, title);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaceContents(wsId);
  },
  deleteNotebook: async (id: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    await notebookRepository.delete(wsId, id);
    useSyncStore.getState().incrementPending();
    if (get().activeNotebookId === id) {
      set({ activeNotebookId: null, activePageId: null });
    }
    await get().loadWorkspaceContents(wsId);
  },
  deleteNotebookSection: async (id: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    await notebookRepository.deleteSection(wsId, id);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaceContents(wsId);
  },
  deleteNotebookPage: async (id: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    await notebookRepository.deletePage(wsId, id);
    useSyncStore.getState().incrementPending();
    if (get().activePageId === id) {
      set({ activePageId: null });
    }
    await get().loadWorkspaceContents(wsId);
  },
  moveNotebook: async (id: string, newWorkspaceId: string, newFolderId: string | null) => {
    await notebookRepository.move(id, newWorkspaceId, newFolderId);
    useSyncStore.getState().incrementPending();
    const wsId = get().activeWorkspaceId;
    if (wsId) await get().loadWorkspaceContents(wsId);
  },
  moveNotebookSection: async (id: string, newWorkspaceId: string, newNotebookId: string) => {
    await notebookRepository.moveSection(id, newWorkspaceId, newNotebookId);
    useSyncStore.getState().incrementPending();
    const wsId = get().activeWorkspaceId;
    if (wsId) await get().loadWorkspaceContents(wsId);
  },
  moveNotebookPage: async (id: string, newWorkspaceId: string, newSectionId: string) => {
    await notebookRepository.movePage(id, newWorkspaceId, newSectionId);
    useSyncStore.getState().incrementPending();
    const wsId = get().activeWorkspaceId;
    if (wsId) await get().loadWorkspaceContents(wsId);
  },
  reorderItems: async (type: 'folder' | 'notebook' | 'canvas' | 'section' | 'page', itemIds: string[]) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    await workspaceRepository.reorderItems(wsId, type, itemIds);
    useSyncStore.getState().incrementPending();
    await get().loadWorkspaceContents(wsId);
  },
}));
