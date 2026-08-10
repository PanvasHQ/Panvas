import { contextBridge, ipcRenderer, webFrame } from 'electron';

// Disable full-app zooming (Ctrl+Wheel / Ctrl+/-) so the UI doesn't shrink/grow unpredictably
webFrame.setZoomLevel(0);
webFrame.setVisualZoomLevelLimits(1, 1);

contextBridge.exposeInMainWorld('panvas', {
  workspace: {
    create: (name: string) => ipcRenderer.invoke('workspace:create', name),
    open: (locationPath: string) => ipcRenderer.invoke('workspace:open', locationPath),
    openDialog: () => ipcRenderer.invoke('workspace:openDialog'),
    getAll: () => ipcRenderer.invoke('workspace:getAll'),
    update: (id: string, updates: any) => ipcRenderer.invoke('workspace:update', id, updates),
    reorder: (wsId: string, type: 'folder' | 'notebook' | 'canvas' | 'section' | 'page', itemIds: string[]) => ipcRenderer.invoke('workspace:reorder', wsId, type, itemIds),
  },
  folder: {
    create: (wsId: string, name: string, parentId: string | null) => ipcRenderer.invoke('folder:create', wsId, name, parentId),
    update: (wsId: string, folderId: string, updates: any) => ipcRenderer.invoke('folder:update', wsId, folderId, updates),
    delete: (wsId: string, folderId: string) => ipcRenderer.invoke('folder:delete', wsId, folderId),
    getAll: (wsId: string) => ipcRenderer.invoke('folder:getAll', wsId),
  },
  canvasFile: {
    create: (wsId: string, name: string, folderId: string | null) => ipcRenderer.invoke('canvasFile:create', wsId, name, folderId),
    update: (wsId: string, canvasId: string, updates: any) => ipcRenderer.invoke('canvasFile:update', wsId, canvasId, updates),
    delete: (wsId: string, canvasId: string) => ipcRenderer.invoke('canvasFile:delete', wsId, canvasId),
    getAll: (wsId: string) => ipcRenderer.invoke('canvasFile:getAll', wsId),
  },
  canvas: {
    save: (wsId: string, canvasId: string, data: any) => ipcRenderer.invoke('canvas:save', wsId, canvasId, data),
    load: (wsId: string, canvasId: string) => ipcRenderer.invoke('canvas:load', wsId, canvasId),
  },
  notebook: {
    create: (wsId: string, name: string, folderId: string | null) => ipcRenderer.invoke('notebook:create', wsId, name, folderId),
    update: (wsId: string, notebookId: string, updates: any) => ipcRenderer.invoke('notebook:update', wsId, notebookId, updates),
    delete: (wsId: string, notebookId: string) => ipcRenderer.invoke('notebook:delete', wsId, notebookId),
    getAll: (wsId: string) => ipcRenderer.invoke('notebook:getAll', wsId),
    savePage: (wsId: string, notebookId: string, pageId: string, data: any) => ipcRenderer.invoke('notebook:savePage', wsId, notebookId, pageId, data),
    loadPage: (wsId: string, notebookId: string, pageId: string) => ipcRenderer.invoke('notebook:loadPage', wsId, notebookId, pageId),
    saveDrawing: (wsId: string, notebookId: string, pageId: string, drawingData: any) => ipcRenderer.invoke('notebook:saveDrawing', wsId, notebookId, pageId, drawingData),
    loadDrawing: (wsId: string, notebookId: string, pageId: string) => ipcRenderer.invoke('notebook:loadDrawing', wsId, notebookId, pageId),
  },
  notebookSection: {
    create: (wsId: string, notebookId: string, name: string) => ipcRenderer.invoke('notebookSection:create', wsId, notebookId, name),
    update: (wsId: string, sectionId: string, updates: any) => ipcRenderer.invoke('notebookSection:update', wsId, sectionId, updates),
    delete: (wsId: string, sectionId: string) => ipcRenderer.invoke('notebookSection:delete', wsId, sectionId),
    getAll: (wsId: string) => ipcRenderer.invoke('notebookSection:getAll', wsId),
  },
  notebookPage: {
    create: (wsId: string, notebookId: string, sectionId: string, title: string) => ipcRenderer.invoke('notebookPage:create', wsId, notebookId, sectionId, title),
    update: (wsId: string, pageId: string, updates: any) => ipcRenderer.invoke('notebookPage:update', wsId, pageId, updates),
    delete: (wsId: string, pageId: string) => ipcRenderer.invoke('notebookPage:delete', wsId, pageId),
    getAll: (wsId: string) => ipcRenderer.invoke('notebookPage:getAll', wsId),
  },
  settings: {
    get: (wsId: string | null, key: string) => ipcRenderer.invoke('settings:get', wsId, key),
    set: (wsId: string | null, key: string, value: any) => ipcRenderer.invoke('settings:set', wsId, key, value),
    setTheme: (theme: string) => ipcRenderer.invoke('theme:set', theme),
  },
  migration: {
    importWorkspace: (workspaceObj: any, canvasDataList: any[]) => ipcRenderer.invoke('migration:importWorkspace', workspaceObj, canvasDataList),
  }
});
