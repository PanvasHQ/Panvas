import * as notebookDB from '@/database/notebookDB';
import type { Notebook, NotebookPage, NotebookSection } from '@/types/notebook';
import { db } from '@/database/schema';

export class NotebookRepository {
  async getAll(userId: string | null): Promise<Notebook[]> {
    if (typeof window !== 'undefined' && window.panvas) {
      const workspaces = await window.panvas.workspace.getAll();
      let all: Notebook[] = [];
      for (const ws of workspaces) {
        const items = await window.panvas.notebook.getAll(ws.id);
        all = all.concat(items.filter((n: any) => !n.deletedAt));
      }
      return all;
    }
    return notebookDB.getNotebooks(userId);
  }
  
  async getSections(userId: string | null): Promise<NotebookSection[]> {
    if (typeof window !== 'undefined' && window.panvas) {
      const workspaces = await window.panvas.workspace.getAll();
      let all: NotebookSection[] = [];
      for (const ws of workspaces) {
        const items = await window.panvas.notebookSection.getAll(ws.id);
        all = all.concat(items.filter((s: any) => !s.deletedAt));
      }
      return all;
    }
    return notebookDB.getSections(userId);
  }
  
  async getPages(userId: string | null): Promise<NotebookPage[]> {
    if (typeof window !== 'undefined' && window.panvas) {
      const workspaces = await window.panvas.workspace.getAll();
      let all: NotebookPage[] = [];
      for (const ws of workspaces) {
        const items = await window.panvas.notebookPage.getAll(ws.id);
        all = all.concat(items.filter((p: any) => !p.deletedAt));
      }
      return all;
    }
    return notebookDB.getPages(userId);
  }

  async create(userId: string | null, workspaceId: string, folderId: string | null, name: string): Promise<Notebook> { 
    if (typeof window !== 'undefined' && window.panvas) {
      return await window.panvas.notebook.create(workspaceId, name, folderId);
    }
    return notebookDB.createNotebook(userId, workspaceId, folderId, name); 
  }
  async createSection(userId: string | null, workspaceId: string, notebookId: string, name: string): Promise<NotebookSection> { 
    if (typeof window !== 'undefined' && window.panvas) {
      return await window.panvas.notebookSection.create(workspaceId, notebookId, name);
    }
    return notebookDB.createSection(userId, notebookId, name); 
  }
  async createPage(userId: string | null, workspaceId: string, notebookId: string, sectionId: string, title: string, type: 'default' | 'pdf' = 'default', pdfDataId?: string): Promise<NotebookPage> {
    if (typeof window !== 'undefined' && window.panvas) {
      const page = await window.panvas.notebookPage.create(workspaceId, notebookId, sectionId, title);
      // Hack for Electron mode without changing IPC definitions right now
      if (type === 'pdf') {
        await window.panvas.notebookPage.update(workspaceId, page.id, { type, pdfDataId });
        page.type = type;
        page.pdfDataId = pdfDataId;
      }
      return page;
    }
    return notebookDB.createPage(userId, notebookId, sectionId, title, type, pdfDataId);
  }
  
  async savePageData(workspaceId: string, notebookId: string, pageId: string, data: any): Promise<void> {
    if (window.panvas?.notebook) {
      return window.panvas.notebook.savePage(workspaceId, notebookId, pageId, data);
    }
  }

  async loadPageData(workspaceId: string, notebookId: string, pageId: string): Promise<any> {
    if (window.panvas?.notebook) {
      return window.panvas.notebook.loadPage(workspaceId, notebookId, pageId);
    }
    return null;
  }

  async saveDrawingData(workspaceId: string, notebookId: string, pageId: string, data: any): Promise<void> {
    if (window.panvas?.notebook) {
      return window.panvas.notebook.saveDrawing(workspaceId, notebookId, pageId, data);
    }
  }

  async loadDrawingData(workspaceId: string, notebookId: string, pageId: string): Promise<any> {
    if (window.panvas?.notebook) {
      return window.panvas.notebook.loadDrawing(workspaceId, notebookId, pageId);
    }
    return null;
  }
  
  async toggleExpanded(workspaceId: string, id: string, isExpanded: boolean): Promise<void> { 
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.notebook.update(workspaceId, id, { isExpanded });
      return;
    }
    return notebookDB.toggleNotebookExpanded(id); 
  }
  
  async toggleSectionExpanded(workspaceId: string, id: string, isExpanded: boolean): Promise<void> { 
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.notebookSection.update(workspaceId, id, { isExpanded });
      return;
    }
    return notebookDB.toggleSectionExpanded(id); 
  }
  
  async rename(workspaceId: string, id: string, name: string): Promise<void> { 
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.notebook.update(workspaceId, id, { name });
      return;
    }
    return notebookDB.renameNotebook(id, name); 
  }
  
  async renameSection(workspaceId: string, id: string, name: string): Promise<void> { 
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.notebookSection.update(workspaceId, id, { name });
      return;
    }
    return notebookDB.renameSection(id, name); 
  }
  
  async renamePage(workspaceId: string, id: string, title: string): Promise<void> { 
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.notebookPage.update(workspaceId, id, { title });
      return;
    }
    return notebookDB.renamePage(id, title); 
  }
  
  async delete(workspaceId: string, id: string): Promise<void> { 
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.notebook.delete(workspaceId, id);
      return;
    }
    return notebookDB.deleteNotebook(id); 
  }
  
  async deleteSection(workspaceId: string, id: string): Promise<void> { 
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.notebookSection.delete(workspaceId, id);
      return;
    }
    return notebookDB.deleteSection(id); 
  }
  
  async deletePage(workspaceId: string, id: string): Promise<void> { 
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.notebookPage.delete(workspaceId, id);
      return;
    }
    return notebookDB.deletePage(id); 
  }
  
  async move(id: string, workspaceId: string, folderId: string | null): Promise<void> { 
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.notebook.update(workspaceId, id, { workspaceId, folderId });
      return;
    }
    return notebookDB.moveNotebook(id, workspaceId, folderId); 
  }

  async moveSection(id: string, workspaceId: string, notebookId: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.notebookSection.update(workspaceId, id, { notebookId });
      return;
    }
  }

  async movePage(id: string, workspaceId: string, sectionId: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.notebookPage.update(workspaceId, id, { sectionId });
      return;
    }
  }
}

export const notebookRepository = new NotebookRepository();
