// ============================================
// Panvas — Main App Component
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { CanvasView } from '@/components/canvas/CanvasView';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { Toast } from '@/components/ui/Toast';
import { CreateDialog } from '@/components/workspace/CreateDialog';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { initializeDatabase } from '@/database/schema';
import { syncScheduler } from '@/services/sync/SyncScheduler';
import { bootstrapCloudSync, getPendingCount, getLastSyncError } from '@/services/sync/SyncEngine';
import { Route, Switch } from 'wouter';
import { LandingPage } from '@/components/marketing/LandingPage';
import { ComingSoonPage } from '@/components/marketing/ComingSoonPage';
import { RoadmapPage } from '@/components/marketing/RoadmapPage';
import { PrivacyPolicyPage } from '@/components/legal/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/components/legal/TermsOfServicePage';
import { SecurityPage } from '@/components/legal/SecurityPage';
// Auth Pages
import { AuthGuard } from '@/components/auth/AuthGuard';
import { AuthCallbackHandler } from '@/components/auth/AuthCallbackHandler';
import { LoginPage } from '@/components/auth/LoginPage';
import { SignUpPage } from '@/components/auth/SignUpPage';
import { VerifyEmailPage } from '@/components/auth/VerifyEmailPage';
import { ForgotPasswordPage } from '@/components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/components/auth/ResetPasswordPage';

export function App() {
  const [isReady, setIsReady] = useState(false);
  const { loadWorkspaces, loadRecentFiles } = useWorkspaceStore();
  const { initAuth, user } = useAuthStore();
  const { setStatus, setPendingChanges, setLastSyncedAt, setLastError } = useSyncStore();
  const bootstrappedUserId = useRef<string | null>(null);

  // Register keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize on mount
  useEffect(() => {
    async function init() {
      try {
        // 1. Initialize Auth (restores session if logged in)
        await initAuth();
        const currentUserId = useAuthStore.getState().user?.id ?? null;

        // 2. Initialize IndexedDB schema strictly for this user context
        await initializeDatabase(currentUserId);

        // 3. Load workspace data strictly scoped to this user
        await loadWorkspaces();
        await loadRecentFiles();

        // 4. Start sync scheduler
        syncScheduler.start();

        setIsReady(true);
      } catch (err) {
        console.error('Failed to initialize Panvas:', err);
        setIsReady(true); // Show app anyway, it's local-first
      }
    }

    init();

    return () => {
      syncScheduler.stop();
    };
  }, [loadWorkspaces, loadRecentFiles, initAuth]);

  useEffect(() => {
    if (!isReady || !user?.id) {
      if (!user?.id) bootstrappedUserId.current = null;
      return;
    }

    if (bootstrappedUserId.current === user.id) return;
    bootstrappedUserId.current = user.id;
    const userId = user.id;

    let cancelled = false;

    async function bootstrap() {
      try {
        setStatus('syncing');
        const { failed } = await bootstrapCloudSync(userId);
        if (cancelled) return;

        setStatus(failed > 0 ? 'error' : 'synced');
        if (failed > 0) setLastError(await getLastSyncError());
        if (failed === 0) {
          setLastSyncedAt(Date.now());
          setLastError(null);
        }

        await loadWorkspaces();
        await loadRecentFiles();
      } catch (err) {
        console.error('[App] Cloud sync bootstrap failed:', err);
        if (!cancelled) {
          setStatus('error');
          setLastError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setPendingChanges(await getPendingCount());
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    isReady,
    user?.id,
    loadWorkspaces,
    loadRecentFiles,
    setStatus,
    setPendingChanges,
    setLastSyncedAt,
  ]);

  // Loading screen
  if (!isReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-panvas-bg-primary">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <img src="/panvas-logo-1.png" alt="Panvas" className="w-16 h-16 rounded-2xl shadow-glass-sm animate-pulse-subtle" />
          <div className="text-center mt-2">
            <p className="text-sm text-panvas-text-tertiary">Loading workspace...</p>
          </div>
          <div className="w-32 h-0.5 rounded-full bg-panvas-bg-tertiary overflow-hidden mt-4">
            <div className="h-full bg-panvas-text-secondary animate-[slideInRight_1.5s_ease-in-out_infinite]"
                 style={{ width: '40%' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/privacy" component={PrivacyPolicyPage} />
        <Route path="/terms" component={TermsOfServicePage} />
        <Route path="/security" component={SecurityPage} />
        <Route path="/roadmap" component={RoadmapPage} />
        
        {/* Conditionally render auth/app routes based on marketing mode */}
        {import.meta.env.VITE_MARKETING_ONLY === 'true' ? (
          <>
            <Route path="/auth/:rest*" component={ComingSoonPage} />
            <Route path="/app" component={ComingSoonPage} />
            <Route path="/private-beta" component={ComingSoonPage} />
          </>
        ) : (
          <>
            <Route path="/auth/login" component={LoginPage} />
            <Route path="/auth/signup" component={SignUpPage} />
            <Route path="/auth/verify-email" component={VerifyEmailPage} />
            <Route path="/auth/forgot-password" component={ForgotPasswordPage} />
            <Route path="/auth/reset-password" component={ResetPasswordPage} />
            <Route path="/auth/callback" component={AuthCallbackHandler} />
            <Route path="/app">
              <AuthGuard>
                <AppShell>
                  <CanvasView />
                </AppShell>
              </AuthGuard>
            </Route>
          </>
        )}
        <Route>
          <LandingPage />
        </Route>
      </Switch>

      {/* Overlays */}
      <CommandPalette />
      <CreateDialog />
      <ContextMenu />
      <Toast />
    </>
  );
}
