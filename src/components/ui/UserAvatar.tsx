// ============================================
// Panvas — User Avatar Component
// ============================================

import React, { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface UserAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserAvatar({ size = 'md', className = '' }: UserAvatarProps) {
  const { user } = useAuthStore();
  
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-16 h-16 text-2xl',
  };

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name;
  const email = user?.email;

  const initials = useMemo(() => {
    if (fullName) {
      const parts = fullName.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return fullName.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return '?';
  }, [fullName, email]);

  const baseClasses = `rounded-full flex items-center justify-center font-medium bg-panvas-bg-tertiary border border-panvas-border-subtle overflow-hidden shrink-0 ${sizeClasses[size]} ${className}`;

  if (avatarUrl) {
    return (
      <div className={baseClasses}>
        <img 
          src={avatarUrl} 
          alt={fullName || email || 'User Avatar'} 
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`${baseClasses} text-panvas-text-secondary`}>
      {initials}
    </div>
  );
}
