import type { CanvasFile, Folder, Workspace } from '@/types/workspace';
import type { Notebook, NotebookPage, NotebookSection } from '@/types/notebook';

/**
 * The bounded renderer bootstrap payload.  It contains metadata needed to
 * render the Library/tree only; page content, canvas scenes, and binary assets
 * are deliberately loaded through their existing lazy repositories.
 */
export interface PanvasBootstrapSnapshot {
  storageRoot: string;
  defaultWorkspaceId: string | null;
  workspaces: Workspace[];
  folders: Folder[];
  canvasFiles: CanvasFile[];
  notebooks: Notebook[];
  notebookSections: NotebookSection[];
  notebookPages: NotebookPage[];
  recentFiles: CanvasFile[];
  trash: {
    workspaces: Workspace[];
    folders: Folder[];
    canvasFiles: CanvasFile[];
    notebooks: Notebook[];
    sections: NotebookSection[];
    pages: NotebookPage[];
  };
  settings: Record<string, unknown>;
}
