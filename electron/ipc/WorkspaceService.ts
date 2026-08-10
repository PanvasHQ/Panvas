import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { app } from 'electron';
import { writeQueue } from './write-queue.js';

export class WorkspaceService {
  private baseDir: string;
  private workspaceRegistry: Map<string, string> = new Map(); // workspaceId -> workspaceDir

  constructor() {
    this.baseDir = path.join(app.getPath('documents'), 'Panvas');
  }

  getWorkspaceDirById(workspaceId: string): string {
    const dir = this.workspaceRegistry.get(workspaceId);
    if (!dir) throw new Error(`Workspace ${workspaceId} not found in registry`);
    return dir;
  }

  registerWorkspace(workspaceId: string, workspaceDir: string) {
    this.workspaceRegistry.set(workspaceId, workspaceDir);
  }

  getWorkspaceDirByName(name: string) {
    return path.join(this.baseDir, name);
  }

  private getPanvasDir(workspaceDir: string) {
    return path.join(workspaceDir, '.panvas');
  }

  private getWorkspaceJsonPath(workspaceDir: string) {
    return path.join(this.getPanvasDir(workspaceDir), 'workspace.json');
  }

  async readWorkspaceJson(workspaceDir: string) {
    const content = await fsPromises.readFile(this.getWorkspaceJsonPath(workspaceDir), 'utf8');
    const ws = JSON.parse(content);
    ws.folders = ws.folders || [];
    ws.canvasFiles = ws.canvasFiles || [];
    ws.notebooks = ws.notebooks || [];
    ws.notebookSections = ws.notebookSections || [];
    ws.notebookPages = ws.notebookPages || [];
    return ws;
  }

  async writeWorkspaceJson(workspaceDir: string, data: any) {
    const filePath = this.getWorkspaceJsonPath(workspaceDir);
    await writeQueue.enqueue(filePath, JSON.stringify(data, null, 2));
  }
  
  async ensureBaseDir() {
    await fsPromises.mkdir(this.baseDir, { recursive: true }).catch(() => {});
  }
}

export const workspaceService = new WorkspaceService();
