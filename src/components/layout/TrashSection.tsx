import React from 'react';
import { Trash2, RotateCcw, X, FileText, Folder as FolderIcon, Layout } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useUIStore } from '@/stores/uiStore';

export function TrashSection() {
  const {
    deletedWorkspaces,
    deletedFolders,
    deletedCanvases,
    restoreItem,
    permanentlyDeleteItem
  } = useWorkspaceStore();

  const [isExpanded, setIsExpanded] = React.useState(false);

  const totalItems = deletedWorkspaces.length + deletedFolders.length + deletedCanvases.length;

  if (totalItems === 0) return null;

  return (
    <section className="border-t border-panvas-border-subtle pt-3" aria-labelledby="trash-heading">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium
                   hover:bg-panvas-bg-hover transition-colors focus-ring
                   ${isExpanded ? 'text-panvas-text-primary' : 'text-panvas-text-tertiary hover:text-panvas-text-secondary'}`}
      >
        <div className="flex items-center gap-2">
          <Trash2 size={13} />
          <span id="trash-heading">Trash</span>
        </div>
        <span className="text-2xs bg-panvas-bg-tertiary px-1.5 rounded-full text-panvas-text-tertiary">
          {totalItems}
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pl-1 mt-1 space-y-0.5">
              {deletedWorkspaces.map(ws => (
                <TrashItemRow
                  key={ws.id}
                  name={ws.name}
                  icon={<Layout size={12} className="text-panvas-text-tertiary" />}
                  onRestore={() => restoreItem(ws.id, 'workspace')}
                  onDelete={() => permanentlyDeleteItem(ws.id, 'workspace')}
                />
              ))}
              {deletedFolders.map(f => (
                <TrashItemRow
                  key={f.id}
                  name={f.name}
                  icon={<FolderIcon size={12} className="text-panvas-text-tertiary" />}
                  onRestore={() => restoreItem(f.id, 'folder')}
                  onDelete={() => permanentlyDeleteItem(f.id, 'folder')}
                />
              ))}
              {deletedCanvases.map(c => (
                <TrashItemRow
                  key={c.id}
                  name={c.name}
                  icon={<FileText size={12} className="text-panvas-text-tertiary" />}
                  onRestore={() => restoreItem(c.id, 'canvas')}
                  onDelete={() => permanentlyDeleteItem(c.id, 'canvas')}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function TrashItemRow({ name, icon, onRestore, onDelete }: { name: string; icon: React.ReactNode; onRestore: () => void; onDelete: () => void }) {
  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to permanently delete "${name}"? This action cannot be undone.`)) {
      onDelete();
    }
  };

  return (
    <div className="group flex items-center justify-between px-2 py-1 rounded-md text-xs hover:bg-panvas-bg-hover">
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="flex-shrink-0">{icon}</span>
        <span className="truncate text-panvas-text-secondary opacity-60 line-through decoration-panvas-text-tertiary">
          {name}
        </span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={onRestore}
          title="Restore"
          className="p-1 rounded-md text-panvas-text-tertiary hover:bg-panvas-bg-elevated hover:text-panvas-text-primary transition-colors"
        >
          <RotateCcw size={12} />
        </button>
        <button
          onClick={handleDelete}
          title="Delete Permanently"
          className="p-1 rounded-md text-panvas-text-tertiary hover:bg-panvas-bg-elevated hover:text-panvas-accent-rose transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
