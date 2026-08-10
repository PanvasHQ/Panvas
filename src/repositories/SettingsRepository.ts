// ============================================
// Panvas — Settings Repository
// ============================================

export class SettingsRepository {
  async get(key: string): Promise<any> {
    if (typeof window !== 'undefined' && window.panvas) {
      // In the current architecture, settings are global or fallback to active workspace.
      // We pass null for workspaceId to hit the global settings.json
      return window.panvas.settings.get(null, key);
    }
    // Web fallback using localStorage
    try {
      const val = localStorage.getItem(`panvas_setting_${key}`);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.settings.set(null, key, value);
      return;
    }
    // Web fallback using localStorage
    try {
      localStorage.setItem(`panvas_setting_${key}`, JSON.stringify(value));
    } catch {
      // ignore
    }
  }
}

export const settingsRepository = new SettingsRepository();
