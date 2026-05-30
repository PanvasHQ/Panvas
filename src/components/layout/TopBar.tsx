// ============================================
// Panvas — Top Bar
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Plus,
  Cloud,
  CloudOff,
  User,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';

export function TopBar() {
  const [, navigate] = useLocation();
  const { isSidebarOpen, toggleSidebar, openCommandPalette } = useUIStore();
  const { activeCanvasId, canvasFiles } = useWorkspaceStore();
  const { isAuthenticated, signOut } = useAuthStore();
  
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const authMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (authMenuRef.current && !authMenuRef.current.contains(event.target as Node)) {
        setIsAuthMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeCanvas = canvasFiles.find(c => c.id === activeCanvasId);

  const handleSignOut = async (redirectTo: string) => {
    setIsAuthMenuOpen(false);
    await signOut();
    navigate(redirectTo);
  };

  return (
    <div className="h-11 flex-shrink-0 flex items-center justify-between px-3 
                    border-b border-panvas-border-subtle bg-panvas-bg-secondary/50
                    backdrop-blur-md z-20 select-none"
         style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* Left */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={toggleSidebar}
          className="btn-icon"
          title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          id="toggle-sidebar-btn"
        >
          {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-panvas-text-tertiary font-medium">
            {activeCanvas ? activeCanvas.name : 'Panvas'}
          </span>
        </div>
      </div>

      {/* Center - Logo */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity cursor-pointer select-none"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onClick={() => {
          useWorkspaceStore.getState().setActiveCanvas(null);
        }}
        title="Go to Home"
      >
        <img src="/panvas-logo-1.png" alt="Panvas" className="w-8 h-8 rounded-lg shadow-glass-sm" />
        <span className="font-handwritten text-xl font-bold tracking-tight text-panvas-text-primary hidden sm:block" style={{ color: 'var(--color-text)' }}>
          Panvas
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={openCommandPalette}
          className="btn-icon hidden sm:flex items-center gap-1.5 px-2"
          title="Search (Ctrl+K)"
          id="search-btn"
        >
          <Search size={15} />
          <span className="text-2xs text-panvas-text-tertiary">Ctrl+K</span>
        </button>

        <button
          onClick={() => {
            const { openCreateDialog } = useUIStore.getState();
            openCreateDialog('canvas');
          }}
          className="btn-icon"
          title="New canvas (Ctrl+N)"
          id="new-canvas-btn"
        >
          <Plus size={18} />
        </button>

        <div className="relative" ref={authMenuRef}>
          <button
            onClick={() => {
              if (isAuthenticated) {
                setIsAuthMenuOpen(!isAuthMenuOpen);
              } else {
                navigate('/auth/login');
              }
            }}
            className={`btn-icon ${isAuthMenuOpen ? 'bg-panvas-bg-tertiary' : ''}`}
            title={isAuthenticated ? 'Account' : 'Sign in for cloud sync'}
            id="auth-btn"
          >
            {isAuthenticated ? (
              <Cloud size={16} className="text-panvas-accent-emerald" />
            ) : (
              <CloudOff size={16} />
            )}
          </button>

          {isAuthMenuOpen && isAuthenticated && (
            <div className="absolute right-0 mt-2 w-56 bg-panvas-bg-secondary border border-panvas-border-subtle rounded-xl shadow-glass-lg p-1.5 z-50">
              <button
                className="w-full text-left px-3 py-2 text-sm text-panvas-text-secondary hover:text-panvas-text-primary hover:bg-panvas-bg-tertiary rounded-lg transition-colors flex items-center gap-2"
                onClick={() => handleSignOut('/')}
              >
                Sign out
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm text-panvas-text-secondary hover:text-panvas-text-primary hover:bg-panvas-bg-tertiary rounded-lg transition-colors flex items-center gap-2"
                onClick={() => handleSignOut('/auth/login')}
              >
                Sign in to different account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
