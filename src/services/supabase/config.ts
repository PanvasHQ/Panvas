export interface SupabaseEnvironment {
  cloudEnabled: boolean;
  url: string;
  anonKey: string;
}

export interface SupabaseConfiguration {
  enabled: boolean;
  url: string;
  anonKey: string;
  error: string | null;
}

export function normalizeSupabaseUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '')
    .replace(/\/auth\/v1$/, '')
    .replace(/\/storage\/v1$/, '');
}

export function resolveSupabaseConfiguration(environment: SupabaseEnvironment): SupabaseConfiguration {
  const url = normalizeSupabaseUrl(environment.url);
  const anonKey = environment.anonKey.trim();

  if (!environment.cloudEnabled) {
    return { enabled: false, url, anonKey, error: 'Cloud sync is disabled; Panvas is running local-only.' };
  }
  if (!url || !anonKey) {
    return { enabled: false, url, anonKey, error: 'Supabase URL and anon key are required for cloud sync.' };
  }

  try {
    const parsed = new URL(url);
    const validHost = /^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname);
    const validRoot = parsed.protocol === 'https:' && validHost && (parsed.pathname === '' || parsed.pathname === '/');
    if (!validRoot || parsed.search || parsed.hash || parsed.username || parsed.password) {
      return {
        enabled: false,
        url,
        anonKey,
        error: 'Supabase URL must be your HTTPS project root, for example https://project-id.supabase.co.',
      };
    }
  } catch {
    return {
      enabled: false,
      url,
      anonKey,
      error: 'Supabase URL must be your HTTPS project root, for example https://project-id.supabase.co.',
    };
  }

  return { enabled: true, url, anonKey, error: null };
}
