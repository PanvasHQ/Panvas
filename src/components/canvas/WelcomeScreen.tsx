import React, { useEffect, useState } from 'react';
import { BookOpen, FolderPlus, Grid2X2, Library, Plus, Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * The no-document state is intentionally small and factual. It offers only
 * actions backed by the workspace model instead of pretending that calendar,
 * task, or import features exist in the canvas home.
 */
export function WelcomeScreen() {
  const [, navigate] = useLocation();
  const { openCreateDialog } = useUIStore();
  const { recentFiles, setActiveCanvas } = useWorkspaceStore();
  const { user } = useAuthStore();
  const [greeting, setGreeting] = useState('Welcome');

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
  }, []);

  const userName = user?.email?.split('@')[0] || 'there';

  return (
    <main className="flex h-full w-full overflow-y-auto bg-panvas-bg-primary" aria-label="Panvas workspace home">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-6 py-10 sm:px-10 sm:py-14">
        <header className="max-w-xl">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-panvas-border-default bg-panvas-bg-elevated text-panvas-accent-violet shadow-sm">
            <Sparkles size={18} aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-panvas-text-primary">{greeting}, {userName}.</h1>
          <p className="mt-2 text-sm leading-6 text-panvas-text-secondary">Create a notebook for structured pages, start a canvas for visual work, or return to the library to continue where you left off.</p>
        </header>

        <section className="mt-10" aria-labelledby="workspace-actions-heading">
          <h2 id="workspace-actions-heading" className="text-2xs font-semibold uppercase tracking-[0.14em] text-panvas-text-tertiary">Start here</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ActionCard icon={<BookOpen size={18} />} title="New notebook" description="Pages, sections, and handwriting" onClick={() => openCreateDialog('notebook')} />
            <ActionCard icon={<Grid2X2 size={18} />} title="New canvas" description="An infinite visual workspace" onClick={() => openCreateDialog('canvas')} />
            <ActionCard icon={<FolderPlus size={18} />} title="New folder" description="Organize notebooks and canvases" onClick={() => openCreateDialog('folder')} />
            <ActionCard icon={<Library size={18} />} title="Open library" description="Browse local work and backups" onClick={() => navigate('/app/library')} />
          </div>
        </section>

        <section className="mt-12" aria-labelledby="recent-work-heading">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="recent-work-heading" className="text-base font-semibold text-panvas-text-primary">Recent canvases</h2>
              <p className="mt-1 text-xs text-panvas-text-tertiary">Only documents stored locally are shown here.</p>
            </div>
            <button type="button" className="btn-ghost shrink-0 text-xs" onClick={() => navigate('/app/library')}>Open library</button>
          </div>

          {recentFiles.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {recentFiles.slice(0, 4).map(file => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setActiveCanvas(file.id)}
                  className="group panvas-surface min-w-0 p-3 text-left transition-shadow hover:shadow-md focus-ring"
                >
                  <div className="flex h-24 items-center justify-center rounded-lg border border-panvas-border-subtle bg-panvas-bg-secondary text-panvas-text-tertiary group-hover:text-panvas-text-secondary">
                    <Grid2X2 size={22} aria-hidden="true" />
                  </div>
                  <p className="mt-3 truncate text-sm font-medium text-panvas-text-primary">{file.name}</p>
                  <p className="mt-1 text-2xs text-panvas-text-tertiary">Infinite canvas</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="panvas-empty-state mt-4 flex min-h-44 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-panvas-bg-elevated text-panvas-text-tertiary"><Plus size={17} aria-hidden="true" /></div>
              <p className="mt-3 text-sm font-medium text-panvas-text-secondary">No recent canvases yet</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-panvas-text-tertiary">Create a notebook or canvas above. Your work stays available locally, even while offline.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ActionCard({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="panvas-surface group flex min-h-32 flex-col items-start p-4 text-left transition-shadow hover:shadow-md focus-ring">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-panvas-bg-secondary text-panvas-text-secondary transition-colors group-hover:bg-panvas-bg-active group-hover:text-panvas-text-primary">{icon}</span>
      <span className="mt-4 text-sm font-medium text-panvas-text-primary">{title}</span>
      <span className="mt-1 text-xs leading-5 text-panvas-text-tertiary">{description}</span>
    </button>
  );
}
