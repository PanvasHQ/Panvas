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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            
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

function ThemeCard({ name, active, icon, onClick, previewColor }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-4 p-6 rounded-2xl border transition-all duration-300 ${
        active 
          ? 'bg-panvas-bg-secondary border-panvas-accent-violet text-panvas-text-primary shadow-[0_0_15px_rgba(var(--accent-violet),0.3)]' 
          : 'bg-panvas-bg-primary border-panvas-border-subtle text-panvas-text-secondary hover:bg-panvas-bg-hover hover:border-panvas-border-strong hover:shadow-glass-sm'
      }`}
    >
      <div className={`w-14 h-14 rounded-full border border-panvas-border-subtle flex items-center justify-center shadow-inner ${previewColor}`}>
        {React.cloneElement(icon as React.ReactElement, { className: active ? 'text-panvas-accent-violet' : 'text-panvas-text-tertiary' })}
      </div>
      <span className="text-sm font-semibold">{name}</span>
    </button>
  );
}
