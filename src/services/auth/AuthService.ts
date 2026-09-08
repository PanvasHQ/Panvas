// ============================================
// Panvas — Auth Service
// Abstracts Supabase auth behind a clean API
// ============================================

import { supabase, isSupabaseConfigured, supabaseConfigError } from '@/services/supabase/client';
import type { User, Session, AuthChangeEvent, Provider } from '@supabase/supabase-js';
import { getValidationMessage, loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema } from '@/lib/validation/auth';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: string | null;
}

export interface SimpleResult {
  error: string | null;
}

const AUTH_BOOT_TIMEOUT_MS = 2_000;
const SESSION_EXPIRY_SKEW_MS = 30_000;

export async function settleWithin<T>(operation: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<null>(resolve => { timeout = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export class AuthService {
  // ---- Email/Password Sign In ----
  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!supabase) {
      return { user: null, session: null, error: supabaseConfigError ?? 'Supabase is not configured' };
    }

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      return { user: null, session: null, error: getValidationMessage(parsed.error) };
    }

    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      return { user: null, session: null, error: error.message };
    }
    return { user: data.user, session: data.session, error: null };
  }

  // ---- Email/Password Sign Up (with metadata) ----
  async signUp(email: string, password: string, fullName?: string): Promise<AuthResult> {
    if (!supabase) {
      return { user: null, session: null, error: supabaseConfigError ?? 'Supabase is not configured' };
    }

    // Validate with the basic fields (signupSchema expects confirmPassword + acceptTerms,
    // but those are validated at the form level. Here we just validate email + password.)
    const basicParsed = loginSchema.safeParse({ email, password });
    if (!basicParsed.success) {
      return { user: null, session: null, error: getValidationMessage(basicParsed.error) };
    }

    const { data, error } = await supabase.auth.signUp({
      email: basicParsed.data.email,
      password: basicParsed.data.password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      return { user: null, session: null, error: error.message };
    }
    return { user: data.user, session: data.session, error: null };
  }

  // ---- OAuth Sign In ----
  async signInWithOAuth(provider: 'google' | 'github'): Promise<SimpleResult> {
    if (!supabase) {
      return { error: supabaseConfigError ?? 'Supabase is not configured' };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  // ---- Handle OAuth Callback ----
  async handleOAuthCallback(): Promise<AuthResult> {
    if (!supabase) {
      return { user: null, session: null, error: 'Supabase is not configured' };
    }

    // Supabase automatically handles the callback when detectSessionInUrl is true.
    // We just need to get the session after the redirect.
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return { user: null, session: null, error: error.message };
    }
    return {
      user: data.session?.user ?? null,
      session: data.session,
      error: data.session ? null : 'No session found after callback',
    };
  }

  // ---- PKCE Code Exchange ----
  async exchangeCodeForSession(code: string): Promise<AuthResult> {
    if (!supabase) {
      return { user: null, session: null, error: 'Supabase is not configured' };
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { user: null, session: null, error: error.message };
    }
    return {
      user: data.session?.user ?? null,
      session: data.session,
      error: null,
    };
  }

  // ---- Forgot Password ----
  async forgotPassword(email: string): Promise<SimpleResult> {
    if (!supabase) {
      return { error: supabaseConfigError ?? 'Supabase is not configured' };
    }

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      return { error: getValidationMessage(parsed.error) };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  // ---- Reset Password ----
  async resetPassword(newPassword: string): Promise<SimpleResult> {
    if (!supabase) {
      return { error: supabaseConfigError ?? 'Supabase is not configured' };
    }

    const parsed = resetPasswordSchema.safeParse({
      password: newPassword,
      confirmPassword: newPassword,
    });
    if (!parsed.success) {
      return { error: getValidationMessage(parsed.error) };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  // ---- Resend Verification Email ----
  async resendVerificationEmail(email: string): Promise<SimpleResult> {
    if (!supabase) {
      return { error: supabaseConfigError ?? 'Supabase is not configured' };
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  // ---- Sign Out ----
  async signOut(): Promise<void> {
    if (supabase) {
      await supabase.auth.signOut();
    }
  }

  // ---- Get Current Session ----
  async getSession(): Promise<Session | null> {
    if (!supabase) return null;
    try {
      const result = await settleWithin(supabase.auth.getSession(), AUTH_BOOT_TIMEOUT_MS);
      if (!result) {
        console.warn('[AuthService] Session restoration timed out; continuing in local-only mode.');
        return null;
      }
      if (result.error) {
        console.warn('[AuthService] Session restoration failed; continuing in local-only mode:', result.error.message);
        return null;
      }
      const session = result.data.session;
      if (session?.expires_at && session.expires_at * 1_000 <= Date.now() + SESSION_EXPIRY_SKEW_MS) {
        console.warn('[AuthService] Stored session is expired; continuing in local-only mode.');
        return null;
      }
      return session;
    } catch (error) {
      console.warn('[AuthService] Auth backend unavailable; continuing in local-only mode:', error);
      return null;
    }
  }

  // ---- Listen for Auth State Changes ----
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): (() => void) | null {
    if (!supabase) return null;
    const { data } = supabase.auth.onAuthStateChange(callback);
    return () => data.subscription.unsubscribe();
  }

  get isConfigured(): boolean {
    return isSupabaseConfigured;
  }
}

export const authService = new AuthService();
