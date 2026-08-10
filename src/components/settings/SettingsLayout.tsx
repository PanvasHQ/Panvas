// ============================================
// Panvas — Settings Layout
// ============================================

import React, { useEffect } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { User, Palette, HardDrive, Info, X } from 'lucide-react';
import { AccountSection } from './sections/AccountSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { WorkspaceSection } from './sections/WorkspaceSection';
import { AboutSection } from './sections/AboutSection';

const SETTINGS_TABS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'workspace', label: 'Workspace', icon: HardDrive },
  { id: 'about', label: 'About', icon: Info },
];

export function SettingsLayout() {
  const [match, params] = useRoute('/app/settings/:tab*');
  const [, navigate] = useLocation();
  
  // Default to account tab if no specific tab is provided
  const activeTab = params?.['tab*'] || 'account';

  // Handle escape key to close settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/app');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 bg-panvas-bg-primary flex overflow-hidden animate-in fade-in duration-200">
      
      {/* Sidebar Navigation */}
      <div className="w-64 bg-panvas-bg-secondary flex flex-col pt-8">
        <div className="px-6 mb-8 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-panvas-text-primary tracking-tight">Settings</h1>
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Link key={tab.id} href={`/app/settings/${tab.id}`}>
                <a className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-panvas-bg-tertiary text-panvas-text-primary' 
                    : 'text-panvas-text-secondary hover:text-panvas-text-primary hover:bg-panvas-bg-tertiary/50'
                }`}>
                  <Icon size={16} className={isActive ? 'text-panvas-text-primary' : 'text-panvas-text-muted'} />
                  {tab.label}
                </a>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative bg-panvas-bg-primary border-l border-panvas-border-subtle overflow-y-auto shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="absolute top-6 right-6">
          <button 
            onClick={() => navigate('/app')}
            className="p-2 text-panvas-text-secondary hover:text-panvas-text-primary hover:bg-panvas-bg-tertiary rounded-full transition-colors"
            title="Close Settings (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 max-w-2xl w-full mx-auto py-16 px-8">
          {activeTab === 'account' && <AccountSection />}
          {activeTab === 'appearance' && <AppearanceSection />}
          {activeTab === 'workspace' && <WorkspaceSection />}
          {activeTab === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  );
}
