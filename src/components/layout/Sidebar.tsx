import React, { useEffect } from 'react';
import {
  Plus,
  Home,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';
import { WorkspaceTree } from '@/components/workspace/WorkspaceTree';
import { TrashSection } from './TrashSection';

export function Sidebar() {
  const {
    workspaces,
    activeWorkspaceId,
    expandedWorkspaceIds,
    loadRecentFiles,
    loadTrash,
    setActiveWorkspace,
    toggleWorkspaceExpanded,
    activeCanvasId,
    setActiveCanvas,
  } = useWorkspaceStore();

  const { openCreateDialog, openContextMenu } = useUIStore();

  useEffect(() => {
    loadRecentFiles();
    loadTrash();
  }, [loadRecentFiles, loadTrash]);

  return (
    <aside className="h-full w-full flex-shrink-0 flex flex-col bg-panvas-bg-primary border-r border-panvas-border-subtle text-sm">
      <div className="px-4 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between px-1 mb-4">
          <span className="text-[11px] font-semibold tracking-[0.14em] text-panvas-text-tertiary uppercase">Library</span>
          <span className="text-2xs text-panvas-text-tertiary">Local</span>
        </div>
        <button
          onClick={() => openCreateDialog('canvas')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                     border border-panvas-border-default bg-panvas-bg-secondary
                     text-panvas-text-primary font-medium
                     hover:bg-panvas-bg-hover hover:border-panvas-border-strong
                     active:bg-panvas-bg-active transition-colors focus-ring"
        >
          <Plus size={16} />
          <span>New item</span>
          <ChevronDown size={14} className="ml-1 text-panvas-text-tertiary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-5 space-y-7">
        <nav aria-label="Workspace navigation" className="space-y-0.5">
          <SidebarNavItem 
            icon={<Home size={16} />} 
            label="Home" 
            isActive={!activeCanvasId} 
            onClick={() => setActiveCanvas(null)} 
          />
        </nav>

        <section aria-labelledby="workspaces-heading">
          <div className="flex items-center justify-between px-2 pb-2.5 group">
            <span id="workspaces-heading" className="text-[11px] font-semibold tracking-[0.12em] text-panvas-text-tertiary uppercase">Workspaces</span>
            <button 
              onClick={() => openCreateDialog('workspace')} 
              className="p-1 -mr-1 rounded text-panvas-text-tertiary hover:bg-panvas-bg-hover hover:text-panvas-text-primary transition-colors focus-ring"
              aria-label="Create workspace"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {workspaces.map(workspace => (
              <SidebarSection
                key={workspace.id}
                title={workspace.name}
                icon={
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold
                    ${activeWorkspaceId === workspace.id ? 'bg-panvas-text-primary text-panvas-bg-primary' : 'bg-panvas-bg-active text-panvas-text-secondary'}
                  `}>
                    {workspace.name.charAt(0)}
                  </div>
                }
                actions={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openContextMenu(e.clientX, e.clientY, workspace.id, 'workspace');
                    }}
                    className="btn-icon p-1 opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                }
                onHeaderClick={() => setActiveWorkspace(workspace.id)}
                isActive={activeWorkspaceId === workspace.id}
                isExpanded={expandedWorkspaceIds.has(workspace.id)}
                onToggleExpanded={() => toggleWorkspaceExpanded(workspace.id)}
                workspaceId={workspace.id}
              >
                <WorkspaceTree workspaceId={workspace.id} />
              </SidebarSection>
            ))}
          </div>
        </section>

        <TrashSection />
      </div>

      <div className="px-5 py-3 border-t border-panvas-border-subtle bg-panvas-bg-primary flex-shrink-0">
        <div className="flex items-center gap-2 text-2xs text-panvas-text-tertiary">
          <span className="w-1.5 h-1.5 rounded-full bg-panvas-text-tertiary/60" aria-hidden="true" />
          <span>Stored on this device</span>
        </div>
      </div>
    </aside>
  );
}

function SidebarNavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md border-l-2 transition-colors focus-ring
      ${isActive ? 'border-panvas-text-primary bg-panvas-bg-hover text-panvas-text-primary font-medium' : 'border-transparent text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary'}`}>
      <div className={isActive ? 'text-panvas-text-primary' : 'text-panvas-text-tertiary'}>{icon}</div>
      <span>{label}</span>
    </button>
  );
}

interface SidebarSectionProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  onHeaderClick?: () => void;
  isActive?: boolean;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  workspaceId?: string;
}

function SidebarSection({
  title,
  icon,
  actions,
  children,
  onHeaderClick,
  isActive,
  defaultExpanded = true,
  isExpanded: controlledIsExpanded,
  onToggleExpanded,
  workspaceId,
}: SidebarSectionProps) {
  const [localIsExpanded, setLocalIsExpanded] = React.useState(defaultExpanded);
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : localIsExpanded;
  
  const handleToggle = () => {
    if (onToggleExpanded) {
      onToggleExpanded();
    } else {
      setLocalIsExpanded(!isExpanded);
    }
  };

  const [isDragOver, setIsDragOver] = React.useState(false);
  const { moveFolder, moveCanvas } = useWorkspaceStore();

  const handleDragOver = (e: React.DragEvent) => {
    if (!workspaceId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!workspaceId) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      
      if (data.type === 'folder') {
        await moveFolder(data.id, workspaceId);
      } else if (data.type === 'canvas') {
        await moveCanvas(data.id, workspaceId, null);
      }
    } catch (err) {
      console.warn('Invalid drop payload', err);
    }
  };

  return (
    <div className="group">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          handleToggle();
          onHeaderClick?.();
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleToggle();
            onHeaderClick?.();
          }
        }}
        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md border-l-2 text-sm font-medium
                    hover:bg-panvas-bg-hover transition-colors group cursor-pointer
                    ${isActive ? 'border-panvas-text-primary bg-panvas-bg-hover text-panvas-text-primary' : 'border-transparent text-panvas-text-secondary'}
                    ${isDragOver ? 'outline outline-1 outline-panvas-border-strong bg-panvas-bg-hover' : ''}`}
      >
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 text-panvas-text-tertiary hover:text-panvas-text-primary ${isExpanded ? '' : '-rotate-90'}`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
        />
        {icon}
        <span className="truncate flex-1 text-left">{title}</span>
        <div className="flex items-center">{actions}</div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
