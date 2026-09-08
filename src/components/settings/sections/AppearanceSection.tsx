import React from 'react';
import { Moon, Sun, PenTool } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function AppearanceSection() {
  const { theme, setTheme } = useUIStore();

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-semibold text-panvas-text-primary mb-2">Appearance</h2>
        <p className="text-sm text-panvas-text-secondary">Customize the look and feel of your workspace.</p>
      </div>

      <div className="grid gap-6 mt-4">
        <div className="flex flex-col gap-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-panvas-text-tertiary">Theme</label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            
            <ThemeCard 
              name="Dark Theme" 
              active={theme === 'dark'} 
              icon={<Moon size={18} />} 
              onClick={() => setTheme('dark')}
              previewColor="bg-[#0D0D0D]"
            />
            
            <ThemeCard 
              name="Light Theme" 
              active={theme === 'light'} 
              icon={<Sun size={18} />} 
              onClick={() => setTheme('light')}
              previewColor="bg-[#FFFFFF]"
            />

            <ThemeCard 
              name="Ink Theme" 
              active={theme === 'ink'} 
              icon={<PenTool size={18} />} 
              onClick={() => setTheme('ink')}
              previewColor="bg-[#F7F4EB]" // Moleskine feel
            />

          </div>
        </div>
      </div>
    </div>
  );
}

interface ThemeCardProps {
  name: string;
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  previewColor: string;
}

function ThemeCard({ name, active, icon, onClick, previewColor }: ThemeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-4 rounded-2xl border p-6 text-left transition-all duration-200 focus-ring ${
        active 
          ? 'border-panvas-accent-violet bg-panvas-bg-secondary text-panvas-text-primary shadow-[0_0_0_1px_rgba(var(--accent-violet),0.18),var(--shadow-surface)]'
          : 'border-panvas-border-subtle bg-panvas-bg-primary text-panvas-text-secondary hover:border-panvas-border-strong hover:bg-panvas-bg-hover hover:shadow-[var(--shadow-surface)]'
      }`}
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-full border border-panvas-border-subtle shadow-inner ${previewColor}`}>
        {React.cloneElement(icon as React.ReactElement, { className: active ? 'text-panvas-accent-violet' : 'text-panvas-text-tertiary' })}
      </div>
      <span className="text-sm font-semibold">{name}</span>
      <span className="-mt-2 text-xs text-panvas-text-tertiary">{active ? 'Selected theme' : 'Switch theme'}</span>
    </button>
  );
}
