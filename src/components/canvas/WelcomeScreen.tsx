import React, { useState, useEffect } from 'react';
import {
  FileText,
  FolderPlus,
  PenTool,
  Calendar,
  CheckCircle2,
  Plus,
  FileImage,
  Clock,
  MoreVertical
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';

export function WelcomeScreen() {
  const { openCreateDialog, showToast } = useUIStore();
  const { recentFiles, setActiveCanvas } = useWorkspaceStore();
  const { user } = useAuthStore();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const userName = user?.email?.split('@')[0] || 'Creator';

  return (
    <div className="w-full h-full flex flex-col bg-panvas-bg-primary overflow-y-auto">
      <div className="max-w-5xl w-full mx-auto px-8 py-12 animate-fade-in">
        
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-panvas-text-primary tracking-tight mb-2">
            {greeting}, {userName}.
          </h1>
          <p className="text-panvas-text-secondary text-sm">
            Here's an overview of your workspace today.
          </p>
        </div>

        {/* Quick Create Grid */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-panvas-text-tertiary uppercase tracking-wider">Quick Create</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <QuickActionCard
              icon={<PenTool size={20} />}
              title="New Canvas"
              desc="Infinite drawing board"
              color="bg-panvas-accent-violet"
              onClick={() => openCreateDialog('canvas')}
            />
            <QuickActionCard
              icon={<FileText size={20} />}
              title="New Document"
              desc="Rich text notes"
              color="bg-panvas-accent-blue"
              onClick={() => openCreateDialog('canvas')}
            />
            <QuickActionCard
              icon={<FolderPlus size={20} />}
              title="New Folder"
              desc="Organize your work"
              color="bg-panvas-accent-emerald"
              onClick={() => openCreateDialog('folder')}
            />
            <QuickActionCard
              icon={<FileImage size={20} />}
              title="Import"
              desc="PDFs, Images, Data"
              color="bg-panvas-accent-amber"
              onClick={() => showToast('To import a PDF, please open a Notebook first.', 'info')}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Continue Working */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-panvas-text-tertiary uppercase tracking-wider">Continue Working</h2>
              <button className="text-xs font-medium text-panvas-accent-violet hover:underline">View All</button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {recentFiles.slice(0, 4).map((file, i) => (
                <RecentFileCard 
                  key={file.id} 
                  file={file} 
                  onClick={() => setActiveCanvas(file.id)}
                  index={i}
                />
              ))}
              {recentFiles.length === 0 && (
                <div className="col-span-2 py-12 flex flex-col items-center justify-center border-2 border-dashed border-panvas-border-subtle rounded-xl bg-panvas-bg-secondary/50">
                  <div className="w-12 h-12 bg-panvas-bg-tertiary rounded-full flex items-center justify-center mb-3">
                     <FileText size={20} className="text-panvas-text-tertiary" />
                  </div>
                  <p className="text-sm font-medium text-panvas-text-primary mb-1">No recent files</p>
                  <p className="text-xs text-panvas-text-tertiary">Create a new canvas to start thinking.</p>
                </div>
              )}
            </div>
          </div>

          {/* Widgets */}
          <div className="space-y-6">
            {/* Calendar Widget */}
            <div className="bg-panvas-bg-secondary border border-panvas-border-subtle rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-panvas-text-primary">
                  <Calendar size={16} className="text-panvas-accent-rose" />
                  <span className="font-semibold text-sm">Schedule</span>
                </div>
                <button className="text-panvas-text-tertiary hover:text-panvas-text-primary transition-colors"><Plus size={14} /></button>
              </div>
              <div className="space-y-3">
                <ScheduleItem time="10:00 AM" title="Design Review" type="meeting" />
                <ScheduleItem time="1:30 PM" title="System Architecture Sync" type="sync" />
                <ScheduleItem time="4:00 PM" title="Focus Time" type="focus" />
              </div>
            </div>

            {/* Tasks Widget */}
            <div className="bg-panvas-bg-secondary border border-panvas-border-subtle rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-panvas-text-primary">
                  <CheckCircle2 size={16} className="text-panvas-accent-emerald" />
                  <span className="font-semibold text-sm">Tasks</span>
                </div>
                <button className="text-panvas-text-tertiary hover:text-panvas-text-primary transition-colors"><Plus size={14} /></button>
              </div>
              <div className="space-y-3">
                <TaskItem title="Finish API endpoint" checked={true} />
                <TaskItem title="Draft Q3 roadmap" checked={false} />
                <TaskItem title="Review PRs" checked={false} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  desc,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start p-4 rounded-xl
                 bg-panvas-bg-secondary border border-panvas-border-subtle
                 hover:border-panvas-border-strong hover:bg-panvas-bg-hover
                 hover:shadow-glass-sm transition-all duration-200 group text-left"
    >
      <div className={`p-2 rounded-lg ${color}/10 text-panvas-text-primary group-hover:scale-110 transition-transform mb-3`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'text-panvas-text-primary' })}
      </div>
      <span className="text-sm font-semibold text-panvas-text-primary mb-1">{title}</span>
      <span className="text-xs text-panvas-text-tertiary">{desc}</span>
    </button>
  );
}

function RecentFileCard({ file, onClick, index }: { file: any, onClick: () => void, index: number }) {
  // Placeholder images for a realistic feel
  const thumbColors = [
    'from-blue-500/20 to-purple-500/20',
    'from-emerald-500/20 to-teal-500/20',
    'from-orange-500/20 to-rose-500/20',
    'from-indigo-500/20 to-cyan-500/20'
  ];
  
  return (
    <button
      onClick={onClick}
      className="flex flex-col text-left group
                 bg-panvas-bg-secondary border border-panvas-border-subtle rounded-xl overflow-hidden
                 hover:border-panvas-accent-violet/50 hover:shadow-glass-sm transition-all"
    >
      <div className={`h-24 w-full bg-gradient-to-br ${thumbColors[index % 4]} flex items-center justify-center border-b border-panvas-border-subtle`}>
        <FileText size={24} className="text-panvas-text-primary opacity-20 group-hover:opacity-40 transition-opacity" />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-panvas-text-primary truncate pr-2">{file.name}</span>
          <MoreVertical size={14} className="text-panvas-text-tertiary opacity-0 group-hover:opacity-100" />
        </div>
        <div className="flex items-center gap-1.5 text-2xs text-panvas-text-tertiary">
          <Clock size={10} />
          <span>Edited just now</span>
        </div>
      </div>
    </button>
  );
}

function ScheduleItem({ time, title, type }: { time: string, title: string, type: 'meeting' | 'sync' | 'focus' }) {
  const colors = {
    meeting: 'bg-panvas-accent-blue',
    sync: 'bg-panvas-accent-violet',
    focus: 'bg-panvas-accent-amber'
  };
  
  return (
    <div className="flex items-center gap-3 group cursor-pointer hover:bg-panvas-bg-hover p-1.5 rounded-lg -ml-1.5 transition-colors">
      <div className="flex flex-col items-end w-12 flex-shrink-0">
        <span className="text-[10px] font-medium text-panvas-text-secondary">{time.split(' ')[0]}</span>
        <span className="text-[9px] text-panvas-text-tertiary">{time.split(' ')[1]}</span>
      </div>
      <div className={`w-1 h-8 rounded-full ${colors[type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-panvas-text-primary truncate">{title}</p>
      </div>
    </div>
  );
}

function TaskItem({ title, checked }: { title: string, checked: boolean }) {
  return (
    <div className="flex items-center gap-3 group cursor-pointer hover:bg-panvas-bg-hover p-1.5 rounded-lg -ml-1.5 transition-colors">
      <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0
        ${checked ? 'bg-panvas-accent-emerald border-panvas-accent-emerald' : 'border-panvas-border-strong group-hover:border-panvas-accent-emerald'}`}>
        {checked && <CheckCircle2 size={10} className="text-white" />}
      </div>
      <p className={`text-xs truncate ${checked ? 'text-panvas-text-tertiary line-through' : 'text-panvas-text-primary font-medium'}`}>
        {title}
      </p>
    </div>
  );
}
