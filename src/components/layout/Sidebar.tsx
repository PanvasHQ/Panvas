// ============================================
// Panvas — Sidebar
// ============================================

import React, { useEffect } from 'react';
import {
  Plus,
  FolderPlus,
  Clock,
  Star,
  ChevronDown,
  MoreHorizontal,
  FileText,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import { WorkspaceTree } from '@/components/workspace/WorkspaceTree';

export function Sidebar() {
  const {
    workspaces,
    recentFiles,
    activeWorkspaceId,
    activeCanvasId,
    loadRecentFiles,
    setActiveCanvas,
    setActiveWorkspace,
  } = useWorkspaceStore();

  const { openCreateDialog, openCommandPalette, openContextMenu } = useUIStore();

  useEffect(() => {
    loadRecentFiles();
  }, [loadRecentFiles]);

  const pinnedFiles = recentFiles.filter(f => f.isPinned);

  return (
    <div className="h-full flex flex-col bg-panvas-bg-secondary border-r border-panvas-border-subtle">
      {/* Sidebar Header */}
      <div className="flex-shrink-0 p-3 space-y-2">
        {/* Search */}
        <button
          onClick={openCommandPalette}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md
                     bg-panvas-bg-primary/50 border border-panvas-border-subtle
                     text-panvas-text-tertiary text-sm shadow-sm
                     hover:bg-panvas-bg-hover hover:text-panvas-text-secondary
                     transition-all duration-150"
          id="sidebar-search-btn"
        >
          <Search size={14} />
          <span className="font-medium text-xs">Search...</span>
          <span className="ml-auto text-[10px] font-mono opacity-60 bg-panvas-bg-tertiary px-1 rounded border border-panvas-border-subtle">⌘K</span>
        </button>

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => openCreateDialog('canvas')}
            className="flex-1 btn-ghost flex items-center justify-center gap-1.5 text-xs"
            id="sidebar-new-canvas-btn"
          >
            <Plus size={13} />
            <span>Canvas</span>
          </button>
          <button
            onClick={() => openCreateDialog('folder')}
            className="flex-1 btn-ghost flex items-center justify-center gap-1.5 text-xs"
            id="sidebar-new-folder-btn"
          >
            <FolderPlus size={13} />
            <span>Folder</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {/* Pinned Section */}
        {pinnedFiles.length > 0 && (
          <SidebarSection title="Pinned" icon={<Star size={12} />}>
            {pinnedFiles.map(file => (
              <button
                key={file.id}
                onClick={() => setActiveCanvas(file.id)}
                className={`sidebar-item w-full text-left ${
                  activeCanvasId === file.id ? 'active' : ''
                }`}
              >
                <FileText size={14} className="text-panvas-accent-violet flex-shrink-0" />
                <span className="truncate text-xs">{file.name}</span>
              </button>
            ))}
          </SidebarSection>
        )}

        {/* Recent Section */}
        {recentFiles.length > 0 && (
          <SidebarSection title="Recent" icon={<Clock size={12} />}>
            {recentFiles.slice(0, 5).map(file => (
              <button
                key={file.id}
                onClick={() => setActiveCanvas(file.id)}
                className={`sidebar-item w-full text-left ${
                  activeCanvasId === file.id ? 'active' : ''
                }`}
              >
                <FileText size={14} className="flex-shrink-0 opacity-50" />
                <span className="truncate text-xs">{file.name}</span>
                <span className="ml-auto text-2xs text-panvas-text-tertiary">
                  {formatTimeAgo(file.lastOpenedAt)}
                </span>
              </button>
            ))}
          </SidebarSection>
        )}

        {/* Workspace Tree */}
        {workspaces.map(workspace => (
          <SidebarSection
            key={workspace.id}
            title={workspace.name}
            icon={
              <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-panvas-accent-violet to-panvas-accent-blue" />
            }
            actions={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openContextMenu(e.clientX, e.clientY, workspace.id, 'workspace');
                }}
                className="btn-icon p-0.5 opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal size={12} />
              </button>
            }
            onHeaderClick={() => setActiveWorkspace(workspace.id)}
            isActive={activeWorkspaceId === workspace.id}
          >
            {activeWorkspaceId === workspace.id && (
              <WorkspaceTree workspaceId={workspace.id} />
            )}
          </SidebarSection>
        ))}

        {/* Add Workspace */}
        <button
          onClick={() => openCreateDialog('workspace')}
          className="w-full sidebar-item text-panvas-text-tertiary hover:text-panvas-text-secondary"
          id="add-workspace-btn"
        >
          <Plus size={14} />
          <span className="text-xs">Add workspace</span>
        </button>
      </div>
    </div>
  );
}

// ---- Sidebar Section ----

interface SidebarSectionProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  onHeaderClick?: () => void;
  isActive?: boolean;
  defaultExpanded?: boolean;
}

function SidebarSection({
  title,
  icon,
  actions,
  children,
  onHeaderClick,
  isActive,
  defaultExpanded = true,
}: SidebarSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <div className="group">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setIsExpanded(!isExpanded);
          onHeaderClick?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
            onHeaderClick?.();
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onHeaderClick?.();
        }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-semibold
                    text-panvas-text-tertiary hover:text-panvas-text-secondary hover:bg-panvas-bg-hover/50 transition-colors
                    ${isActive ? 'text-panvas-text-primary' : ''}`}
      >
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 text-panvas-text-tertiary ${isExpanded ? '' : '-rotate-90'}`}
        />
        {icon}
        <span className="truncate tracking-wide">{title}</span>
        <div className="ml-auto flex items-center">{actions}</div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pl-1 mt-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Utility ----

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}
