// ============================================
// Panvas — Auth Store (Zustand)
// Uses AuthService for all authentication operations
// ============================================

import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { authService } from '@/services/auth/AuthService';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvasStore } from '@/stores/canvasStore';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  
  // High-level actions
  initAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null; needsVerification: boolean }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: string | null }>;
  forgotPassword: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (newPassword: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

let authInitialization: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),

  initAuth: () => {
    if (authInitialization) return authInitialization;
    authInitialization = (async () => {
      try {
        if (!authService.isConfigured) return;

        const session = await authService.getSession();
        if (session) {
          set({ session, user: session.user, isAuthenticated: true });
        }

        // Register once even when React StrictMode replays the bootstrap effect.
        authService.onAuthStateChange((_event, newSession) => {
          set({
            session: newSession,
            user: newSession?.user ?? null,
            isAuthenticated: !!newSession?.user,
          });
        });
      } catch (err) {
        console.warn('[AuthStore] Auth unavailable; continuing in local-only mode:', err);
      } finally {
        set({ isLoading: false });
      }
    })();
    return authInitialization;
  },

  signIn: async (email, password) => {
    const result = await authService.signIn(email, password);
    if (result.error) {
      return { error: result.error };
    }

    set({
      session: result.session,
      user: result.user,
      isAuthenticated: !!result.user,
    });

    return { error: null };
  },

  signUp: async (email, password, fullName) => {
    const result = await authService.signUp(email, password, fullName);
    if (result.error) {
      return { error: result.error, needsVerification: false };
    }

    set({
      session: result.session,
      user: result.user,
      isAuthenticated: !!result.session?.user,
    });

    return { error: null, needsVerification: !result.session };
  },

  signInWithOAuth: async (provider) => {
    const result = await authService.signInWithOAuth(provider);
    return { error: result.error };
  },

  forgotPassword: async (email) => {
    const result = await authService.forgotPassword(email);
    return { error: result.error };
  },

  resetPassword: async (newPassword) => {
    const result = await authService.resetPassword(newPassword);
    return { error: result.error };
  },

  resendVerification: async (email) => {
    const result = await authService.resendVerificationEmail(email);
    return { error: result.error };
  },

  signOut: async () => {
    try {
      await authService.signOut();
      
      // Switch the in-memory view back to anonymous local records. User-scoped
      // records stay on this device and become visible again after that user
      // signs in; signing out must never be a destructive data operation.
      useWorkspaceStore.getState().reset();
      useCanvasStore.getState().reset();
      const { loadWorkspaces, loadRecentFiles } = useWorkspaceStore.getState();
      await loadWorkspaces();
      await loadRecentFiles();

      set({ user: null, session: null, isAuthenticated: false });
    } catch (err) {
      console.error('[AuthStore] Failed to sign out:', err);
    }
  },
}));
