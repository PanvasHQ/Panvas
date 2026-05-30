// ============================================
// Panvas — Supabase Client
// ============================================

import { createClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');

  return trimmed
    .replace(/\/rest\/v1$/, '')
    .replace(/\/auth\/v1$/, '')
    .replace(/\/storage\/v1$/, '');
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const isValidSupabaseUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl);

// Only create client if credentials are configured
export const supabase = supabaseUrl && supabaseAnonKey && isValidSupabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isSupabaseConfigured = !!supabase;
export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? 'Supabase URL and anon key are required for cloud sync.'
  : !isValidSupabaseUrl
    ? 'Supabase URL must be your project root, for example https://project-id.supabase.co.'
    : null;
