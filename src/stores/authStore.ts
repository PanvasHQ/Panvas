// ============================================
// Panvas — Auth Store (Zustand)
// Uses AuthService for all authentication operations
// ============================================

import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { authService } from '@/services/auth/AuthService';
import { clearDatabase, db } from '@/database/schema';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useSyncStore } from '@/stores/syncStore';

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),

  initAuth: async () => {
    try {
      if (!authService.isConfigured) {
        set({ isLoading: false });
        return;
      }

      const session = await authService.getSession();
      if (session) {
        // Handle OAuth cross-contamination check
        const workspaces = await useWorkspaceStore.getState().workspaces;
        if (workspaces.some(ws => ws.userId !== null && ws.userId !== session.user.id)) {
          console.warn('[AuthStore] Contaminated database detected. Wiping local data.');
          await clearDatabase();
          useWorkspaceStore.getState().reset();
          useCanvasStore.getState().reset();
          useSyncStore.getState().reset();
        }
        
        set({ session, user: session.user, isAuthenticated: true });
      }

      // Listen for auth changes
      authService.onAuthStateChange(async (_event, newSession) => {
        if (newSession?.user) {
          const wks = await useWorkspaceStore.getState().workspaces;
          if (wks.some(ws => ws.userId !== null && ws.userId !== newSession.user.id)) {
            await clearDatabase();
            useWorkspaceStore.getState().reset();
            useCanvasStore.getState().reset();
            useSyncStore.getState().reset();
          }
        }
        
        set({ 
          session: newSession, 
          user: newSession?.user ?? null, 
          isAuthenticated: !!newSession?.user 
        });
      });
    } catch (err) {
      console.error('[AuthStore] Failed to initialize auth:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    const result = await authService.signIn(email, password);
    if (result.error) {
      return { error: result.error };
    }

    // Security: If the local database has data from a previous logged-in user, wipe it
    // to prevent cross-account data leaks. Offline data (userId === null) is safe to inherit.
    const workspaces = await useWorkspaceStore.getState().workspaces;
    if (workspaces.some(ws => ws.userId !== null && ws.userId !== result.user?.id)) {
      console.warn('[AuthStore] Contaminated database detected. Wiping local data.');
      await clearDatabase();
      useWorkspaceStore.getState().reset();
      useCanvasStore.getState().reset();
      useSyncStore.getState().reset();
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

    if (result.user) {
      const workspaces = await useWorkspaceStore.getState().workspaces;
      if (workspaces.some(ws => ws.userId !== null && ws.userId !== result.user?.id)) {
        console.warn('[AuthStore] Contaminated database detected. Wiping local data.');
        await clearDatabase();
        useWorkspaceStore.getState().reset();
        useCanvasStore.getState().reset();
        useSyncStore.getState().reset();
      }
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
    
    // We cannot immediately clear the database here because OAuth redirects.
    // The wipe logic for OAuth must be handled in initAuth() during the callback.
    
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
      
      // Clear memory stores before wiping db
      useWorkspaceStore.getState().reset();
      useCanvasStore.getState().reset();
      useSyncStore.getState().reset();
      
      // Wipe the database completely
      await clearDatabase();
      
      // After DB is wiped, re-initialize defaults is handled inside clearDatabase
      const { loadWorkspaces, loadRecentFiles } = useWorkspaceStore.getState();
      await loadWorkspaces();
      await loadRecentFiles();

      set({ user: null, session: null, isAuthenticated: false });
    } catch (err) {
      console.error('[AuthStore] Failed to sign out:', err);
    }
  },
}));
