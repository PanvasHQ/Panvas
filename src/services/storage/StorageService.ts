// ============================================
// Panvas — Storage Service
// ============================================

import { useAuthStore } from '@/stores/authStore';

export interface StorageMetrics {
  usedBytes: number;
  storageLimitBytes: number | null; // null means no limit (e.g. Local Development)
  plan: string | null;
  percentageUsed: number | null;
  status: 'healthy' | 'warning' | 'critical' | 'unlimited';
}

export class StorageService {
  /**
   * Calculates the exact local storage bytes used by the IndexedDB database.
   * Relies on navigator.storage API, falls back to 0 if unavailable.
   */
  static async getUsedBytes(): Promise<number> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      } catch (e) {
        console.warn('Failed to estimate storage usage', e);
        return 0;
      }
    }
    return 0;
  }

  /**
   * Retrieves the user's plan from Supabase app_metadata, and computes
   * their storage limit and current health status.
   */
  static async getMetrics(): Promise<StorageMetrics> {
    const user = useAuthStore.getState().user;
    const usedBytes = await this.getUsedBytes();

    // If local mode (no user), return unlimited development state
    if (!user) {
      return {
        usedBytes,
        storageLimitBytes: null,
        plan: 'Development',
        percentageUsed: null,
        status: 'unlimited',
      };
    }

    // Attempt to extract plan and limit from app_metadata
    const plan = user.app_metadata?.plan || null;
    const limitBytes = user.app_metadata?.storage_limit_bytes; // e.g. defined by future backend

    if (typeof limitBytes !== 'number') {
      return {
        usedBytes,
        storageLimitBytes: null,
        plan,
        percentageUsed: null,
        status: 'healthy',
      };
    }

    const storageLimitBytes = limitBytes;
    const percentageUsed = (usedBytes / storageLimitBytes) * 100;
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (percentageUsed >= 90) status = 'critical';
    else if (percentageUsed >= 70) status = 'warning';

    return {
      usedBytes,
      storageLimitBytes,
      plan,
      percentageUsed,
      status,
    };
  }

  /**
   * Helper to format bytes into readable strings (e.g. 1.2 MB, 5 GB)
   */
  static formatBytes(bytes: number, decimals = 2): string {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }
}
