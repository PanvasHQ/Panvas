// ============================================
// Panvas — Welcome Screen
// ============================================

import React from 'react';
import {
  FileText,
  FolderPlus,
  Sparkles,
  BookOpen,
  PenTool,
  Code2,
  Sigma,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvasStore } from '@/stores/canvasStore';

export function WelcomeScreen() {
  const { openCreateDialog } = useUIStore();
  const { recentFiles, setActiveCanvas, workspaces, createWorkspace, createCanvas } = useWorkspaceStore();
  const { addBlock } = useCanvasStore();

  const handleQuickAction = async (type: string) => {
    try {
      let wsId = workspaces[0]?.id;
      if (!wsId) {
        const ws = await createWorkspace('My Workspace');
        wsId = ws.id;
      }
      const canvas = await createCanvas(null, `New ${type} Canvas`);
      setActiveCanvas(canvas.id);
      
      // If a specific block type is requested, wait for data load and add it
      if (type !== 'Draw') {
        setTimeout(async () => {
          try {
            const blockType = type === 'Markdown' ? 'markdown' : type === 'LaTeX' ? 'latex' : null;
            if (blockType) {
              await addBlock(blockType, 200, 200);
            }
          } catch (e) {
             console.error('Failed to add block', e);
          }
        }, 1000); // give canvas time to initialize
      }
    } catch (err) {
      console.error('Failed quick action:', err);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-panvas-bg-primary">
      <div className="max-w-lg w-full px-8 animate-fade-in">
        {/* Logo & Tagline */}
        <div className="text-center mb-10 flex flex-col items-center">
          <img src="/panvas-logo-1.png" alt="Panvas" className="w-20 h-20 rounded-2xl shadow-glass-sm mb-4" />
          <h1 className="text-3xl font-bold text-panvas-text-primary mb-2 tracking-wide font-sketch">Panvas</h1>
          <p className="text-panvas-text-secondary text-sm max-w-xs mx-auto">
            A visual thinking workspace for engineers, researchers, and technical students.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <QuickAction
            icon={<FileText size={18} />}
            label="New Canvas"
            desc="Start drawing and thinking"
            onClick={() => openCreateDialog('canvas')}
          />
          <QuickAction
            icon={<FolderPlus size={18} />}
            label="New Folder"
            desc="Organize your work"
            onClick={() => openCreateDialog('folder')}
          />
        </div>

        {/* Features */}
        <div className="flex items-center justify-center gap-6 mb-8 text-panvas-text-tertiary">
          <FeaturePill icon={<PenTool size={12} />} label="Draw" onClick={() => handleQuickAction('Draw')} />
          <FeaturePill icon={<BookOpen size={12} />} label="Markdown" onClick={() => handleQuickAction('Markdown')} />
          <FeaturePill icon={<Sigma size={12} />} label="LaTeX" onClick={() => handleQuickAction('LaTeX')} />
          <FeaturePill icon={<Code2 size={12} />} label="Code" onClick={() => handleQuickAction('Markdown')} />
        </div>

        {/* Recent Files */}
        {recentFiles.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-panvas-text-tertiary uppercase tracking-wider mb-2">
              Recent
            </h3>
            <div className="space-y-1">
              {recentFiles.slice(0, 4).map(file => (
                <button
                  key={file.id}
                  onClick={() => setActiveCanvas(file.id)}
                  className="sidebar-item w-full text-left"
                >
                  <FileText size={14} className="opacity-40" />
                  <span className="text-sm">{file.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shortcuts hint */}
        <div className="mt-8 text-center">
          <p className="text-2xs text-panvas-text-tertiary">
            <kbd className="px-1.5 py-0.5 rounded bg-panvas-bg-tertiary text-panvas-text-tertiary border border-panvas-border-subtle">
              Ctrl+K
            </kbd>
            {' '}to search {' · '}
            <kbd className="px-1.5 py-0.5 rounded bg-panvas-bg-tertiary text-panvas-text-tertiary border border-panvas-border-subtle">
              Ctrl+N
            </kbd>
            {' '}new canvas
          </p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl
                 bg-panvas-bg-secondary border border-panvas-border-subtle
                 hover:border-panvas-accent-violet/30 hover:bg-panvas-bg-hover
                 hover:shadow-glow-violet transition-all duration-200 group"
    >
      <div className="text-panvas-text-tertiary group-hover:text-panvas-accent-violet transition-colors">
        {icon}
      </div>
      <span className="text-sm font-medium text-panvas-text-primary">{label}</span>
      <span className="text-2xs text-panvas-text-tertiary">{desc}</span>
    </button>
  );
}

function FeaturePill({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
                 bg-panvas-bg-tertiary border border-panvas-border-subtle text-xs
                 hover:border-panvas-accent-violet hover:text-panvas-text-primary transition-colors">
      {icon}
      <span>{label}</span>
    </button>
  );
}
