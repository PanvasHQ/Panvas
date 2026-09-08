// ============================================
// Panvas — Supabase Client
// ============================================

import { createClient } from '@supabase/supabase-js';
import { CLOUD_SYNC_ENABLED } from '@/config/features';
import { resolveSupabaseConfiguration } from './config';

const configuration = resolveSupabaseConfiguration({
  cloudEnabled: CLOUD_SYNC_ENABLED,
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
});

// Local builds never construct a remote client merely because stale credentials
// remain in an environment file. Automatic token refresh is also disabled at
// construction time so an expired browser token cannot block application boot.
export const supabase = configuration.enabled
  ? createClient(configuration.url, configuration.anonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isSupabaseConfigured = !!supabase;
export const supabaseConfigError = configuration.error;
