// ============================================
// Panvas — Canvas Store (Zustand)
// Uses CanvasRepository for data operations
// ============================================

import { create } from 'zustand';
import type { CanvasData, CustomBlock, BlockType } from '@/types/canvas';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useAuthStore } from './authStore';
import { useSyncStore } from './syncStore';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface CanvasState {
  // Current canvas data
  currentData: CanvasData | null;
  customBlocks: CustomBlock[];
  saveStatus: SaveStatus;

  // Excalidraw API reference
  excalidrawAPI: any | null;
  setExcalidrawAPI: (api: any) => void;

  // Data loading
  loadCanvasData: (canvasFileId: string) => Promise<void>;
  saveCanvasData: (data: Partial<CanvasData> & { canvasFileId: string }) => Promise<void>;
  clearCurrentCanvas: () => void;

  // Custom blocks
  addBlock: (type: BlockType, x: number, y: number, content?: string) => Promise<CustomBlock>;
  updateBlock: (id: string, updates: Partial<CustomBlock>) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  loadBlocks: (canvasFileId: string) => Promise<void>;

  // Save status
  setSaveStatus: (status: SaveStatus) => void;
  
  reset: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  currentData: null,
  customBlocks: [],
  saveStatus: 'idle',
  excalidrawAPI: null,

  reset: () => {
    set({
      currentData: null,
      customBlocks: [],
      saveStatus: 'idle',
    });
  },

  setExcalidrawAPI: (api) => set({ excalidrawAPI: api }),

  loadCanvasData: async (canvasFileId: string) => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const data = await canvasRepository.loadData(userId, canvasFileId);
    const blocks = await canvasRepository.loadBlocks(userId, canvasFileId);
    set({
      currentData: data || null,
      customBlocks: blocks,
      saveStatus: 'idle',
    });
  },

  saveCanvasData: async (data: Partial<CanvasData> & { canvasFileId: string }) => {
    set({ saveStatus: 'saving' });
    try {
      const userId = useAuthStore.getState().user?.id ?? null;
      await canvasRepository.saveData(userId, data);
      useSyncStore.getState().incrementPending();
      
      const current = get().currentData;
      set({ 
        saveStatus: 'saved',
        currentData: {
          ...current,
          ...data,
          version: (current?.version || 0) + 1,
          updatedAt: Date.now()
        } as CanvasData
      });
      
      // Reset to idle after 2 seconds
      setTimeout(() => {
        if (get().saveStatus === 'saved') {
          set({ saveStatus: 'idle' });
        }
      }, 2000);
    } catch (err) {
      console.error('[CanvasStore] Save failed:', err);
      set({ saveStatus: 'error' });
    }
  },

  clearCurrentCanvas: () => {
    set({ currentData: null, customBlocks: [], saveStatus: 'idle' });
  },

  addBlock: async (type: BlockType, x: number, y: number, content?: string) => {
    const current = get().currentData;
    if (!current) throw new Error('No active canvas');

    const defaultContent = type === 'markdown'
      ? '# New Note\n\nStart typing...'
      : type === 'latex'
        ? 'E = mc^2'
        : '';

    const userId = useAuthStore.getState().user?.id ?? null;
    const block = await canvasRepository.addBlock(userId, {
      canvasFileId: current.canvasFileId,
      type,
      x,
      y,
      width: type === 'pdf' ? 500 : 320,
      height: type === 'pdf' ? 650 : type === 'markdown' ? 250 : 120,
      content: content || defaultContent,
    });
    useSyncStore.getState().incrementPending();

    set({ customBlocks: [...get().customBlocks, block] });
    return block;
  },

  updateBlock: async (id: string, updates: Partial<CustomBlock>) => {
    await canvasRepository.updateBlock(id, updates);
    useSyncStore.getState().incrementPending();
    set({
      customBlocks: get().customBlocks.map(b =>
        b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b
      ),
    });
  },

  deleteBlock: async (id: string) => {
    await canvasRepository.deleteBlock(id);
    useSyncStore.getState().incrementPending();
    set({ customBlocks: get().customBlocks.filter(b => b.id !== id) });
  },

  loadBlocks: async (canvasFileId: string) => {
    const userId = useAuthStore.getState().user?.id ?? null;
    const blocks = await canvasRepository.loadBlocks(userId, canvasFileId);
    set({ customBlocks: blocks });
  },

  setSaveStatus: (status) => set({ saveStatus: status }),
}));
