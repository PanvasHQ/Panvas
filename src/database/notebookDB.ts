import { db } from './schema';
import type { Notebook, NotebookPage, NotebookSection } from '@/types/notebook';
import { generateId } from '@/lib/utils/id';

export async function getNotebooks(userId: string | null): Promise<Notebook[]> {
  return db.notebooks.filter(notebook => notebook.userId === userId).sortBy('order');
}

export async function getSections(userId: string | null): Promise<NotebookSection[]> {
  return db.notebookSections.filter(section => section.userId === userId).sortBy('order');
}

export async function getPages(userId: string | null): Promise<NotebookPage[]> {
  return db.notebookPages.filter(page => page.userId === userId).sortBy('order');
}

export async function createNotebook(userId: string | null, workspaceId: string, folderId: string | null, name: string): Promise<Notebook> {
  const now = Date.now();
  const order = await db.notebooks.where('workspaceId').equals(workspaceId).count();
  const notebook: Notebook = { id: generateId('notebook'), workspaceId, folderId, name, createdAt: now, updatedAt: now, order, isExpanded: true, userId };
  await db.notebooks.add(notebook);
  return notebook;
}

export async function createSection(userId: string | null, notebookId: string, name: string): Promise<NotebookSection> {
  const now = Date.now();
  const order = await db.notebookSections.where('notebookId').equals(notebookId).count();
  const section: NotebookSection = { id: generateId('section'), notebookId, name, createdAt: now, updatedAt: now, order, isExpanded: true, userId };
  await db.notebookSections.add(section);
  return section;
}

export async function createPage(userId: string | null, notebookId: string, sectionId: string, title: string, type: 'default' | 'pdf' = 'default', pdfDataId?: string): Promise<NotebookPage> {
  const now = Date.now();
  const order = await db.notebookPages.where('sectionId').equals(sectionId).count();
  const page: NotebookPage = { id: generateId('page'), notebookId, sectionId, title, createdAt: now, updatedAt: now, order, userId, type, pdfDataId };
  await db.notebookPages.add(page);
  return page;
}

export async function toggleNotebookExpanded(id: string): Promise<void> {
  const notebook = await db.notebooks.get(id);
  if (notebook) await db.notebooks.update(id, { isExpanded: !notebook.isExpanded, updatedAt: Date.now() });
}

export async function toggleSectionExpanded(id: string): Promise<void> {
  const section = await db.notebookSections.get(id);
  if (section) await db.notebookSections.update(id, { isExpanded: !section.isExpanded, updatedAt: Date.now() });
}

export async function renameNotebook(id: string, name: string): Promise<void> {
  await db.notebooks.update(id, { name, updatedAt: Date.now() });
}

export async function renameSection(id: string, name: string): Promise<void> {
  await db.notebookSections.update(id, { name, updatedAt: Date.now() });
}

export async function renamePage(id: string, title: string): Promise<void> {
  await db.notebookPages.update(id, { title, updatedAt: Date.now() });
}

export async function deleteNotebook(id: string): Promise<void> {
  const sections = await db.notebookSections.where('notebookId').equals(id).toArray();
  for (const s of sections) {
    await deleteSection(s.id);
  }
  await db.notebooks.delete(id);
}

export async function deleteSection(id: string): Promise<void> {
  const pages = await db.notebookPages.where('sectionId').equals(id).toArray();
  for (const p of pages) {
    await deletePage(p.id);
  }
  await db.notebookSections.delete(id);
}

export async function deletePage(id: string): Promise<void> {
  await db.notebookPages.delete(id);
}

export async function moveNotebook(id: string, workspaceId: string, folderId: string | null): Promise<void> {
  await db.notebooks.update(id, { workspaceId, folderId, updatedAt: Date.now() });
}
