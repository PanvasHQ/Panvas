// ============================================
// Panvas — Workspace Store (Zustand)
// Uses Repository layer for all operations
// ============================================

import { create } from 'zustand';
import type { Workspace, Folder, CanvasFile } from '@/types/workspace';
import { workspaceRepository } from '@/repositories/WorkspaceRepository';
import { folderRepository } from '@/repositories/FolderRepository';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useAuthStore } from './authStore';
import { useSyncStore } from './syncStore';

const ACTIVE_WORKSPACE_KEY = 'panvas.activeWorkspaceId';
const ACTIVE_CANVAS_KEY = 'panvas.activeCanvasId';

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
  recentFiles: CanvasFile[];

  // Selection
  activeWorkspaceId: string | null;
  activeCanvasId: string | null;

  // Loading
  isLoading: boolean;

  // Actions
  loadWorkspaces: () => Promise<void>;
  loadWorkspaceContents: (workspaceId: string) => Promise<void>;
  loadRecentFiles: () => Promise<void>;
  setActiveWorkspace: (id: string | null) => void;
  setActiveCanvas: (id: string | null) => void;
  reset: () => void;

  // CRUD
  createWorkspace: (name: string) => Promise<Workspace>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  togglePinWorkspace: (id: string) => Promise<void>;

  createFolder: (parentId: string | null, name: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  toggleFolderExpanded: (id: string) => Promise<void>;

  createCanvas: (folderId: string | null, name: string) => Promise<CanvasFile>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;
  togglePinCanvas: (id: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  folders: [],
  canvasFiles: [],
  recentFiles: [],
  activeWorkspaceId: null,
  activeCanvasId: null,
  isLoading: true,

  reset: () => {
    set({
      workspaces: [],
      folders: [],
      canvasFiles: [],
      recentFiles: [],
      activeWorkspaceId: null,
      activeCanvasId: null,
      isLoading: true,
    });
  },

  loadWorkspaces: async () => {
    set({ isLoading: true });
    const userId = useAuthStore.getState().user?.id ?? null;
    const workspaces = await workspaceRepository.getAll(userId);
    set({ workspaces, isLoading: false });

    // Restore previous workspace if available, otherwise select the first one.
    if (!get().activeWorkspaceId && workspaces.length > 0) {
      const storedWorkspaceId = readStoredId(ACTIVE_WORKSPACE_KEY);
      const restoredWorkspace = workspaces.find(ws => ws.id === storedWorkspaceId);
      get().setActiveWorkspace(restoredWorkspace?.id ?? workspaces[0].id);
    }
  },

  loadWorkspaceContents: async (workspaceId: string) => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const folders = await folderRepository.getByWorkspace(userId, workspaceId);
    const canvasFiles = await canvasRepository.getByWorkspace(userId, workspaceId);
    set({ folders, canvasFiles });

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

  setActiveCanvas: (id: string | null) => {
    const previousWorkspaceId = get().activeWorkspaceId;
    const canvas = id
      ? get().canvasFiles.find(c => c.id === id) ?? get().recentFiles.find(c => c.id === id)
      : null;

    set({
      activeCanvasId: id,
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
    await folderRepository.rename(id, name);
    useSyncStore.getState().incrementPending();
    const wsId = get().activeWorkspaceId;
    if (wsId) await get().loadWorkspaceContents(wsId);
  },

  deleteFolder: async (id: string) => {
    await folderRepository.delete(id);
    useSyncStore.getState().incrementPending();
    const wsId = get().activeWorkspaceId;
    if (wsId) await get().loadWorkspaceContents(wsId);
  },

  toggleFolderExpanded: async (id: string) => {
    await folderRepository.toggleExpanded(id);
    const wsId = get().activeWorkspaceId;
    if (wsId) await get().loadWorkspaceContents(wsId);
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
    const userId = useAuthStore.getState().user?.id ?? null;
    await canvasRepository.rename(userId, id, name);
    useSyncStore.getState().incrementPending();
    const wsId = get().activeWorkspaceId;
    if (wsId) await get().loadWorkspaceContents(wsId);
  },

  deleteCanvas: async (id: string) => {
    await canvasRepository.delete(id);
    useSyncStore.getState().incrementPending();
    if (get().activeCanvasId === id) {
      set({ activeCanvasId: null });
      writeStoredId(ACTIVE_CANVAS_KEY, null);
    }
    const wsId = get().activeWorkspaceId;
    if (wsId) await get().loadWorkspaceContents(wsId);
    await get().loadRecentFiles();
  },

  togglePinCanvas: async (id: string) => {
    await canvasRepository.togglePin(id);
    useSyncStore.getState().incrementPending();
    const wsId = get().activeWorkspaceId;
    if (wsId) await get().loadWorkspaceContents(wsId);
  },
}));
