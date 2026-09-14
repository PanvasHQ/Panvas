import path from 'path';
import { promises as fsPromises } from 'fs';
import type { AtomicWriteData } from './write-queue.js';

interface PageWorkspace {
  notebookPages: Array<Record<string, unknown>>;
}

interface PageWriteQueue {
  enqueue(filePath: string, data: AtomicWriteData): Promise<void>;
}

export interface CreateNotebookPageOptions {
  workspaceDir: string;
  workspace: PageWorkspace;
  notebookId: string;
  sectionId: string;
  title: string;
  type: 'default' | 'pdf';
  pdfDataId?: string;
  pageId: string;
  now: number;
  writeWorkspace(): Promise<void>;
  writeQueue: PageWriteQueue;
}

export async function createNotebookPageFiles(options: CreateNotebookPageOptions): Promise<Record<string, unknown>> {
  const page: Record<string, unknown> = {
    id: options.pageId,
    notebookId: options.notebookId,
    sectionId: options.sectionId,
    title: options.title,
    type: options.type,
    createdAt: options.now,
    updatedAt: options.now,
    lastOpenedAt: options.now,
    order: options.workspace.notebookPages.length,
    pagePropertyOverrides: {},
    deletedAt: null,
  };
  if (options.type === 'pdf') page.pdfDataId = options.pdfDataId;

  options.workspace.notebookPages.push(page);
  await options.writeWorkspace();

  const pagesDir = path.join(options.workspaceDir, 'Notebooks', options.notebookId, 'pages');
  await fsPromises.mkdir(pagesDir, { recursive: true });
  await options.writeQueue.enqueue(path.join(pagesDir, `${options.pageId}.json`), JSON.stringify(page, null, 2));
  await options.writeQueue.enqueue(
    path.join(pagesDir, `${options.pageId}.content.json`),
    JSON.stringify({ type: 'doc', content: [] }, null, 2),
  );
  return page;
}
