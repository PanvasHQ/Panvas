// ============================================
// Panvas — Account Section
// ============================================

import React from 'react';
import { useAuthStore } from '@/stores/authStore';
import { UserAvatar } from '@/components/ui/UserAvatar';

export function AccountSection() {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-300">
        <h2 className="text-xl font-semibold text-panvas-text-primary">My Account</h2>
        <div className="p-6 bg-panvas-bg-tertiary rounded-xl border border-panvas-border-subtle text-panvas-text-secondary">
          You are not currently signed in. Sign in to sync your workspace across devices.
        </div>
      </div>
    );
  }

  const memberSince = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown';
  const provider = user.app_metadata?.provider || 'Email';

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-semibold text-panvas-text-primary mb-1">My Account</h2>
        <p className="text-sm text-panvas-text-secondary">Manage your profile and authentication preferences.</p>
      </div>

      <div className="flex items-center gap-6 p-6 bg-panvas-bg-secondary rounded-2xl border border-panvas-border-subtle shadow-glass-sm">
        <UserAvatar size="lg" />
        <div className="flex flex-col">
          <h3 className="text-lg font-medium text-panvas-text-primary">
            {user.user_metadata?.full_name || user.user_metadata?.name || 'Panvas User'}
          </h3>
          <p className="text-sm text-panvas-text-secondary mt-0.5">{user.email}</p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-panvas-text-muted">Account Details</label>
          <div className="bg-panvas-bg-secondary rounded-xl border border-panvas-border-subtle overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-panvas-border-subtle">
              <span className="text-sm text-panvas-text-secondary">Authentication Provider</span>
              <span className="text-sm font-medium text-panvas-text-primary capitalize">{provider}</span>
            </div>
            <div className="flex items-center justify-between p-4 border-b border-panvas-border-subtle">
              <span className="text-sm text-panvas-text-secondary">Account Status</span>
              <span className="text-sm font-medium text-panvas-accent-emerald bg-panvas-accent-emerald/10 px-2 py-0.5 rounded-full">Active</span>
            </div>
            <div className="flex items-center justify-between p-4">
              <span className="text-sm text-panvas-text-secondary">Member Since</span>
              <span className="text-sm font-medium text-panvas-text-primary">{memberSince}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
