import { ipcMain, app, dialog, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { generateId } from '../../src/lib/utils/id.js';
import { writeQueue } from './write-queue.js';
import { workspaceService } from './WorkspaceService.js';

export function registerDomainHandlers() {
  // ---- WORKSPACE ----

  ipcMain.handle('workspace:create', async (event, name: string) => {
    await workspaceService.ensureBaseDir();
    const workspaceId = generateId('ws');
    const workspaceDir = workspaceService.getWorkspaceDirByName(name);
    const panvasDir = path.join(workspaceDir, '.panvas');
    
    await fsPromises.mkdir(panvasDir, { recursive: true });
    
    const now = Date.now();
    const workspaceObj = {
      id: workspaceId,
      name,
      createdAt: now,
      updatedAt: now,
      isPinned: false,
      syncStatus: 'local',
      userId: null,
      deletedAt: null,
      isSystem: false,
      version: 1,
      folders: [],
      canvasFiles: [],
      notebooks: [],
      notebookSections: [],
      notebookPages: []
    };

    await fsPromises.writeFile(path.join(panvasDir, 'system.json'), JSON.stringify({ version: 1, migration_complete: true }, null, 2));
    await fsPromises.writeFile(path.join(panvasDir, 'workspace.json'), JSON.stringify(workspaceObj, null, 2));
    await fsPromises.writeFile(path.join(panvasDir, 'settings.json'), JSON.stringify({ version: 1 }, null, 2));
    
    await fsPromises.mkdir(path.join(panvasDir, 'journal'), { recursive: true });
    await fsPromises.mkdir(path.join(panvasDir, 'recovery'), { recursive: true });
    await fsPromises.mkdir(path.join(panvasDir, 'temp'), { recursive: true });
    await fsPromises.mkdir(path.join(panvasDir, 'Plugins'), { recursive: true });
    
    await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'images'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'pdfs'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'videos'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'audio'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'attachments'), { recursive: true });
    
    await fsPromises.mkdir(path.join(workspaceDir, 'Notebooks'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'Canvas'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'PDF'), { recursive: true });
    
    workspaceService.registerWorkspace(workspaceId, workspaceDir);
    return workspaceObj;
  });

  ipcMain.handle('workspace:openDialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = win 
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    
    const workspaceDir = result.filePaths[0];
    const panvasDir = path.join(workspaceDir, '.panvas');
    
    // Check if it's already a workspace
    if (fs.existsSync(panvasDir)) {
      try {
        const ws = await workspaceService.readWorkspaceJson(workspaceDir);
        workspaceService.registerWorkspace(ws.id, workspaceDir);
        return ws;
      } catch (e) {
        throw new Error('Selected folder is not a valid Panvas workspace or is corrupted.');
      }
    } else {
      // Initialize new workspace
      const name = path.basename(workspaceDir);
      const workspaceId = generateId('ws');
      
      await fsPromises.mkdir(panvasDir, { recursive: true });
      
      const now = Date.now();
      const workspaceObj = {
        id: workspaceId,
        name,
        createdAt: now,
        updatedAt: now,
        isPinned: false,
        syncStatus: 'local',
        userId: null,
        deletedAt: null,
        isSystem: false,
        version: 1,
        folders: [],
        canvasFiles: [],
        notebooks: [],
        notebookSections: [],
        notebookPages: []
      };

      await fsPromises.writeFile(path.join(panvasDir, 'system.json'), JSON.stringify({ version: 1, migration_complete: true }, null, 2));
      await fsPromises.writeFile(path.join(panvasDir, 'workspace.json'), JSON.stringify(workspaceObj, null, 2));
      await fsPromises.writeFile(path.join(panvasDir, 'settings.json'), JSON.stringify({ version: 1 }, null, 2));
      
      await fsPromises.mkdir(path.join(panvasDir, 'journal'), { recursive: true });
      await fsPromises.mkdir(path.join(panvasDir, 'recovery'), { recursive: true });
      await fsPromises.mkdir(path.join(panvasDir, 'temp'), { recursive: true });
      await fsPromises.mkdir(path.join(panvasDir, 'Plugins'), { recursive: true });
      
      await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'images'), { recursive: true });
      await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'pdfs'), { recursive: true });
      await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'videos'), { recursive: true });
      await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'audio'), { recursive: true });
      await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'attachments'), { recursive: true });
      
      await fsPromises.mkdir(path.join(workspaceDir, 'Notebooks'), { recursive: true });
      await fsPromises.mkdir(path.join(workspaceDir, 'Canvas'), { recursive: true });
      await fsPromises.mkdir(path.join(workspaceDir, 'PDF'), { recursive: true });
      
      workspaceService.registerWorkspace(workspaceId, workspaceDir);
      return workspaceObj;
    }
  });

  ipcMain.handle('workspace:getAll', async (event) => {
    await workspaceService.ensureBaseDir();
    const defaultLocation = workspaceService.getWorkspaceDirByName('');
    
    const workspaces: any[] = [];
    const entries = await fsPromises.readdir(defaultLocation, { withFileTypes: true }).catch(() => []);
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const workspaceDir = path.join(defaultLocation, entry.name);
        try {
          const ws = await workspaceService.readWorkspaceJson(workspaceDir);
          workspaceService.registerWorkspace(ws.id, workspaceDir);
          workspaces.push(ws);
        } catch (e) {
          // Not a panvas workspace or corrupted
        }
      }
    }
    return workspaces;
  });

  ipcMain.handle('workspace:update', async (event, workspaceId: string, updates: any) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    Object.assign(ws, updates, { updatedAt: Date.now() });
    await workspaceService.writeWorkspaceJson(dir, ws);
    return ws;
  });

  ipcMain.handle('workspace:reorder', async (event, workspaceId: string, type: 'folder' | 'notebook' | 'canvas' | 'section' | 'page', itemIds: string[]) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    
    let array: any[];
    if (type === 'folder') array = ws.folders;
    else if (type === 'notebook') array = ws.notebooks;
    else if (type === 'canvas') array = ws.canvasFiles;
    else if (type === 'section') array = ws.notebookSections;
    else if (type === 'page') array = ws.notebookPages;
    else return false;

    const idToIndex = new Map(itemIds.map((id, index) => [id, index]));
    
    array.sort((a, b) => {
      const idxA = idToIndex.has(a.id) ? idToIndex.get(a.id)! : 999999;
      const idxB = idToIndex.has(b.id) ? idToIndex.get(b.id)! : 999999;
      return idxA - idxB;
    });

    array.forEach((item, index) => {
      item.order = index;
    });

    await workspaceService.writeWorkspaceJson(dir, ws);
    return true;
  });

  // ---- FOLDERS ----
  
  ipcMain.handle('folder:create', async (event, workspaceId: string, name: string, parentId: string | null) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    const folder = {
      id: generateId('f'),
      workspaceId,
      parentId,
      name,
      order: ws.folders.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      isExpanded: false
    };
    ws.folders.push(folder);
    await workspaceService.writeWorkspaceJson(dir, ws);
    return folder;
  });

  ipcMain.handle('folder:getAll', async (event, workspaceId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    return ws.folders || [];
  });

  ipcMain.handle('folder:update', async (event, workspaceId: string, folderId: string, updates: any) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    const folder = ws.folders.find((f: any) => f.id === folderId);
    if (folder) {
      Object.assign(folder, updates, { updatedAt: Date.now() });
      await workspaceService.writeWorkspaceJson(dir, ws);
    }
    return folder;
  });

  ipcMain.handle('folder:delete', async (event, workspaceId: string, folderId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    ws.folders = ws.folders.filter((f: any) => f.id !== folderId);
    await workspaceService.writeWorkspaceJson(dir, ws);
    return true;
  });

  // ---- CANVAS FILES (Metadata) ----
  
  ipcMain.handle('canvasFile:create', async (event, workspaceId: string, name: string, folderId: string | null) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    const canvasFile = {
      id: generateId('canvas'),
      workspaceId,
      folderId,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastOpenedAt: Date.now(),
      order: ws.canvasFiles.length,
      isPinned: false,
      deletedAt: null
    };
    ws.canvasFiles.push(canvasFile);
    await workspaceService.writeWorkspaceJson(dir, ws);
    
    // Create the empty canvas content file
    const canvasData = { canvasFileId: canvasFile.id, elements: [], appState: {}, files: {}, version: 1 };
    const contentPath = path.join(dir, 'Canvas', `${canvasFile.id}.json`);
    await writeQueue.enqueue(contentPath, JSON.stringify(canvasData, null, 2));
    
    return canvasFile;
  });

  ipcMain.handle('canvasFile:getAll', async (event, workspaceId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    return ws.canvasFiles || [];
  });

  ipcMain.handle('canvasFile:update', async (event, workspaceId: string, canvasId: string, updates: any) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    const canvas = ws.canvasFiles.find((c: any) => c.id === canvasId);
    if (canvas) {
      Object.assign(canvas, updates, { updatedAt: Date.now() });
      await workspaceService.writeWorkspaceJson(dir, ws);
    }
    return canvas;
  });

  ipcMain.handle('canvasFile:delete', async (event, workspaceId: string, canvasId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    ws.canvasFiles = ws.canvasFiles.filter((c: any) => c.id !== canvasId);
    await workspaceService.writeWorkspaceJson(dir, ws);
    return true;
  });

  // ---- CANVAS DATA (Content) ----

  ipcMain.handle('canvas:save', async (event, workspaceId: string, canvasId: string, data: any) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const contentPath = path.join(dir, 'Canvas', `${canvasId}.json`);
    await writeQueue.enqueue(contentPath, JSON.stringify(data, null, 2));
  });

  ipcMain.handle('canvas:load', async (event, workspaceId: string, canvasId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const contentPath = path.join(dir, 'Canvas', `${canvasId}.json`);
    if (fs.existsSync(contentPath)) {
      const content = await fsPromises.readFile(contentPath, 'utf8');
      return JSON.parse(content);
    }
    return null;
  });
  
  // ---- NOTEBOOKS ----

  ipcMain.handle('notebook:create', async (event, workspaceId: string, name: string, folderId: string | null) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    
    // Create notebook dir
    const notebook = {
      id: generateId('nb'),
      workspaceId,
      folderId,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0,
      deletedAt: null
    };
    
    const nbDir = path.join(dir, 'Notebooks', notebook.id);
    await fsPromises.mkdir(path.join(nbDir, 'pages'), { recursive: true });
    
    await writeQueue.enqueue(path.join(nbDir, 'notebook.json'), JSON.stringify(notebook, null, 2));
    
    // We also need to update workspace.json temporarily until we refactor loadWorkspaceContents
    const ws = await workspaceService.readWorkspaceJson(dir);
    ws.notebooks.push(notebook);
    await workspaceService.writeWorkspaceJson(dir, ws);
    
    return notebook;
  });

  ipcMain.handle('notebook:getAll', async (event, workspaceId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    return ws.notebooks || [];
  });

  ipcMain.handle('notebook:update', async (event, workspaceId: string, notebookId: string, updates: any) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    const nb = ws.notebooks.find((n: any) => n.id === notebookId);
    if (nb) {
      Object.assign(nb, updates, { updatedAt: Date.now() });
      await workspaceService.writeWorkspaceJson(dir, ws);
    }
    return nb;
  });

  ipcMain.handle('notebook:delete', async (event, workspaceId: string, notebookId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    ws.notebooks = ws.notebooks.filter((n: any) => n.id !== notebookId);
    await workspaceService.writeWorkspaceJson(dir, ws);
    return true;
  });

  ipcMain.handle('notebookSection:create', async (event, workspaceId: string, notebookId: string, name: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const section = {
      id: generateId('sec'),
      notebookId,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0,
      deletedAt: null
    };
    
    // For now, continue saving sections in workspace.json to avoid rewriting the entire read path for sections immediately
    const ws = await workspaceService.readWorkspaceJson(dir);
    section.order = ws.notebookSections.length;
    ws.notebookSections.push(section);
    await workspaceService.writeWorkspaceJson(dir, ws);
    return section;
  });

  ipcMain.handle('notebookSection:getAll', async (event, workspaceId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    return ws.notebookSections || [];
  });

  ipcMain.handle('notebookSection:update', async (event, workspaceId: string, sectionId: string, updates: any) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    const section = ws.notebookSections.find((s: any) => s.id === sectionId);
    if (section) {
      Object.assign(section, updates, { updatedAt: Date.now() });
      await workspaceService.writeWorkspaceJson(dir, ws);
    }
    return section;
  });

  ipcMain.handle('notebookSection:delete', async (event, workspaceId: string, sectionId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    ws.notebookSections = ws.notebookSections.filter((s: any) => s.id !== sectionId);
    await workspaceService.writeWorkspaceJson(dir, ws);
    return true;
  });

  ipcMain.handle('notebookPage:create', async (event, workspaceId: string, notebookId: string, sectionId: string, title: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    const page = {
      id: generateId('page'),
      notebookId,
      sectionId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: ws.notebookPages.length,
      deletedAt: null
    };
    
    ws.notebookPages.push(page);
    await workspaceService.writeWorkspaceJson(dir, ws);
    
    // Create page metadata and content files
    const pagesDir = path.join(dir, 'Notebooks', notebookId, 'pages');
    await fsPromises.mkdir(pagesDir, { recursive: true });

    const pagePath = path.join(pagesDir, `${page.id}.json`);
    const contentPath = path.join(pagesDir, `${page.id}.content.json`);
    
    await writeQueue.enqueue(pagePath, JSON.stringify(page, null, 2));
    await writeQueue.enqueue(contentPath, JSON.stringify({ type: 'doc', content: [] }, null, 2)); // Empty TipTap doc
    
    return page;
  });

  ipcMain.handle('notebookPage:getAll', async (event, workspaceId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    return ws.notebookPages || [];
  });

  ipcMain.handle('notebookPage:update', async (event, workspaceId: string, pageId: string, updates: any) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    const page = ws.notebookPages.find((p: any) => p.id === pageId);
    if (page) {
      Object.assign(page, updates, { updatedAt: Date.now() });
      await workspaceService.writeWorkspaceJson(dir, ws);
    }
    return page;
  });

  ipcMain.handle('notebookPage:delete', async (event, workspaceId: string, pageId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const ws = await workspaceService.readWorkspaceJson(dir);
    ws.notebookPages = ws.notebookPages.filter((p: any) => p.id !== pageId);
    await workspaceService.writeWorkspaceJson(dir, ws);
    return true;
  });

  ipcMain.handle('notebook:savePage', async (event, workspaceId: string, notebookId: string, pageId: string, data: any) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const pagesDir = path.join(dir, 'Notebooks', notebookId, 'pages');
    await fsPromises.mkdir(pagesDir, { recursive: true });
    
    const contentPath = path.join(pagesDir, `${pageId}.content.json`);
    await writeQueue.enqueue(contentPath, JSON.stringify(data, null, 2));
  });

  ipcMain.handle('notebook:loadPage', async (event, workspaceId: string, notebookId: string, pageId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const contentPath = path.join(dir, 'Notebooks', notebookId, 'pages', `${pageId}.content.json`);
    if (fs.existsSync(contentPath)) {
      const content = await fsPromises.readFile(contentPath, 'utf8');
      return JSON.parse(content);
    }
    return null;
  });

  ipcMain.handle('notebook:saveDrawing', async (event, workspaceId: string, notebookId: string, pageId: string, drawingData: any) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const pagesDir = path.join(dir, 'Notebooks', notebookId, 'pages');
    await fsPromises.mkdir(pagesDir, { recursive: true });

    const drawingPath = path.join(pagesDir, `${pageId}.drawing.json`);
    await writeQueue.enqueue(drawingPath, JSON.stringify(drawingData, null, 2));
  });

  ipcMain.handle('notebook:loadDrawing', async (event, workspaceId: string, notebookId: string, pageId: string) => {
    const dir = workspaceService.getWorkspaceDirById(workspaceId);
    const drawingPath = path.join(dir, 'Notebooks', notebookId, 'pages', `${pageId}.drawing.json`);
    if (fs.existsSync(drawingPath)) {
      const content = await fsPromises.readFile(drawingPath, 'utf8');
      return JSON.parse(content);
    }
    return null;
  });

  // ---- SETTINGS ----
  ipcMain.handle('settings:get', async (event, workspaceId: string | null, key: string) => {
    // For now, settings are workspace-specific since there's no global config file in this app's current fs architecture.
    // However, if workspaceId is null, we might need a fallback or global settings.
    // In Joplin, settings are global. Let's create a global settings file in the panvasDataDir.
    const settingsPath = path.join(app.getPath('userData'), 'panvas', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const content = await fsPromises.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(content);
      return settings[key] !== undefined ? settings[key] : null;
    }
    return null;
  });

  ipcMain.handle('settings:set', async (event, workspaceId: string | null, key: string, value: any) => {
    const settingsPath = path.join(app.getPath('userData'), 'panvas', 'settings.json');
    let settings: any = {};
    if (fs.existsSync(settingsPath)) {
      const content = await fsPromises.readFile(settingsPath, 'utf8');
      settings = JSON.parse(content);
    } else {
      await fsPromises.mkdir(path.join(app.getPath('userData'), 'panvas'), { recursive: true });
    }
    settings[key] = value;
    await writeQueue.enqueue(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  });

  // ---- THEME ----
  ipcMain.handle('theme:set', async (event, theme: 'light' | 'dark' | 'ink') => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const symbolColor = theme === 'dark' ? '#ffffff' : '#000000';
      const bgColor = theme === 'dark' ? '#0d0d0d' : theme === 'ink' ? '#f7f4eb' : '#ffffff';
      
      // Update the titleBarOverlay
      win.setTitleBarOverlay({
        color: bgColor,
        symbolColor: symbolColor
      });
    }
    return true;
  });

  // ---- MIGRATION ----
  ipcMain.handle('migration:importWorkspace', async (event, workspaceObj: any, canvasDataList: any[]) => {
    await workspaceService.ensureBaseDir();
    const workspaceDir = workspaceService.getWorkspaceDirByName(workspaceObj.name);
    const panvasDir = path.join(workspaceDir, '.panvas');
    
    // Idempotency: if workspace.json exists, we don't overwrite if it's already fully migrated
    // But to be safe, we will just construct it.
    await fsPromises.mkdir(panvasDir, { recursive: true });
    
    await fsPromises.writeFile(path.join(panvasDir, 'system.json'), JSON.stringify({ version: 1, migration_complete: true }, null, 2));
    await fsPromises.writeFile(path.join(panvasDir, 'workspace.json'), JSON.stringify(workspaceObj, null, 2));
    await fsPromises.writeFile(path.join(panvasDir, 'settings.json'), JSON.stringify({ version: 1 }, null, 2));
    
    await fsPromises.mkdir(path.join(panvasDir, 'journal'), { recursive: true });
    await fsPromises.mkdir(path.join(panvasDir, 'recovery'), { recursive: true });
    await fsPromises.mkdir(path.join(panvasDir, 'temp'), { recursive: true });
    await fsPromises.mkdir(path.join(panvasDir, 'Plugins'), { recursive: true });
    
    await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'images'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'pdfs'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'videos'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'audio'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'Assets', 'attachments'), { recursive: true });
    
    await fsPromises.mkdir(path.join(workspaceDir, 'Notebooks'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'Canvas'), { recursive: true });
    await fsPromises.mkdir(path.join(workspaceDir, 'PDF'), { recursive: true });

    // Ensure notebook directories exist
    if (workspaceObj.notebooks) {
      for (const nb of workspaceObj.notebooks) {
        await fsPromises.mkdir(path.join(workspaceDir, 'Notebooks', nb.id, 'pages'), { recursive: true });
      }
    }

    // Write canvas data
    for (const cd of canvasDataList) {
      const contentPath = path.join(workspaceDir, 'Canvas', `${cd.canvasFileId}.json`);
      await writeQueue.enqueue(contentPath, JSON.stringify(cd, null, 2));
    }
    
    workspaceService.registerWorkspace(workspaceObj.id, workspaceDir);
    return true;
  });
}
