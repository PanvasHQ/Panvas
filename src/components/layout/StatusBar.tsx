// ============================================
// Panvas — Status Bar
// ============================================

import React from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { SyncIndicator } from '../ui/SyncIndicator';
import { useSyncStore } from '@/stores/syncStore';
import { CLOUD_SYNC_ENABLED } from '@/config/features';

export function StatusBar() {
  const { saveStatus } = useCanvasStore();
  const { activeCanvasId } = useWorkspaceStore();
  const isOnline = useSyncStore(state => state.isOnline);

  const statusConfig = {
    idle: { dot: 'bg-panvas-text-tertiary', text: 'Ready' },
    saving: { dot: 'bg-panvas-accent-amber animate-pulse', text: 'Saving...' },
    saved: { dot: 'bg-panvas-accent-emerald', text: 'Saved' },
    error: { dot: 'bg-panvas-accent-rose', text: 'Save failed' },
  };

  const status = statusConfig[saveStatus];

  return (
    <div className="h-6 flex-shrink-0 flex items-center justify-between px-3
                    border-t border-panvas-border-subtle bg-panvas-bg-secondary/30
                    text-2xs text-panvas-text-tertiary select-none">
      <div className="flex items-center gap-3">
        {activeCanvasId && <SyncIndicator />}

        {/* Canvas and notebook editors share the same local save state. Keep
            it visible on every workspace surface so failures are never only
            communicated by an expiring toast. */}
        <div
          data-testid="save-status"
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-panvas-text-tertiary"
        >
          <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          <span>{status.text}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span role="status" aria-label="Connectivity" className="text-panvas-text-tertiary">{isOnline ? (CLOUD_SYNC_ENABLED ? 'Online' : 'Local only') : 'Offline · saved locally'}</span>
        <span className="opacity-50">v0.1.0</span>
      </div>
    </div>
  );
}
