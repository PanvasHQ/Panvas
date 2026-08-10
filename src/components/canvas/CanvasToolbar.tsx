import React, { useState, useEffect } from 'react';
import { 
  MousePointer2, 
  Hand,
  Square,
  Circle,
  ArrowRight,
  Minus,
  PenTool,
  Type,
  Image as ImageIcon,
  Eraser,
  Undo2,
  Redo2,
  Library
} from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useUIStore } from '@/stores/uiStore';

export function CanvasToolbar() {
  const { excalidrawAPI } = useCanvasStore();
  const [activeTool, setActiveTool] = useState('selection');
  
  // Track active tool from Excalidraw
  useEffect(() => {
    if (!excalidrawAPI) return;
    
    const updateActiveTool = () => {
      const state = excalidrawAPI.getAppState();
      setActiveTool(state.activeTool.type);
    };

    // We use a small interval since Excalidraw doesn't fire an event for just tool changes in all versions
    const interval = setInterval(updateActiveTool, 200);
    return () => clearInterval(interval);
  }, [excalidrawAPI]);

  if (!excalidrawAPI) return null;

  const setTool = (type: string) => {
    excalidrawAPI.setActiveTool({ type });
    setActiveTool(type);
  };

  const undo = () => {
    // There isn't a direct API for undo without firing a keyboard event, but wait
    // We can just simulate the keyboard event or use excalidrawAPI.resetScene? No.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
  };

  const redo = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }));
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-in-up">
      <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-panvas-bg-elevated border border-panvas-border-strong shadow-glass">
        
        <ToolButton 
          icon={<MousePointer2 size={16} />} 
          isActive={activeTool === 'selection'} 
          onClick={() => setTool('selection')} 
          tooltip="Select (V)"
        />
        <ToolButton 
          icon={<Hand size={16} />} 
          isActive={activeTool === 'hand'} 
          onClick={() => setTool('hand')} 
          tooltip="Pan (Space)"
        />
        
        <div className="w-px h-6 bg-panvas-border-subtle mx-1" />
        
        <ToolButton 
          icon={<PenTool size={16} />} 
          isActive={activeTool === 'freedraw'} 
          onClick={() => setTool('freedraw')} 
          tooltip="Draw (P)"
          color="text-panvas-accent-violet"
          activeBg="bg-panvas-accent-violet text-white"
        />
        <ToolButton 
          icon={<Eraser size={16} />} 
          isActive={activeTool === 'eraser'} 
          onClick={() => setTool('eraser')} 
          tooltip="Eraser (E)"
        />
        
        <div className="w-px h-6 bg-panvas-border-subtle mx-1" />

        <ToolButton 
          icon={<Square size={16} />} 
          isActive={activeTool === 'rectangle'} 
          onClick={() => setTool('rectangle')} 
          tooltip="Rectangle (R)"
        />
        <ToolButton 
          icon={<Circle size={16} />} 
          isActive={activeTool === 'ellipse'} 
          onClick={() => setTool('ellipse')} 
          tooltip="Ellipse (O)"
        />
        <ToolButton 
          icon={<ArrowRight size={16} />} 
          isActive={activeTool === 'arrow'} 
          onClick={() => setTool('arrow')} 
          tooltip="Arrow (A)"
        />
        <ToolButton 
          icon={<Minus size={16} />} 
          isActive={activeTool === 'line'} 
          onClick={() => setTool('line')} 
          tooltip="Line (L)"
        />
        <ToolButton 
          icon={<Type size={16} />} 
          isActive={activeTool === 'text'} 
          onClick={() => setTool('text')} 
          tooltip="Text (T)"
        />

        <div className="w-px h-6 bg-panvas-border-subtle mx-1" />

        <ToolButton 
          icon={<Library size={16} />} 
          isActive={false} 
          onClick={() => {
            const state = excalidrawAPI.getAppState();
            excalidrawAPI.updateScene({ appState: { openSidebar: state.openSidebar?.name === 'library' ? null : { name: 'library' } } });
          }} 
          tooltip="Library"
        />

        <div className="w-px h-6 bg-panvas-border-subtle mx-1" />

        <ToolButton 
          icon={<Undo2 size={16} />} 
          isActive={false} 
          onClick={undo} 
          tooltip="Undo"
        />
        <ToolButton 
          icon={<Redo2 size={16} />} 
          isActive={false} 
          onClick={redo} 
          tooltip="Redo"
        />
      </div>
    </div>
  );
}

function ToolButton({ 
  icon, 
  isActive, 
  onClick, 
  tooltip,
  color = 'text-panvas-text-secondary',
  activeBg = 'bg-panvas-bg-active text-panvas-text-primary'
}: { 
  icon: React.ReactNode, 
  isActive: boolean, 
  onClick: () => void, 
  tooltip: string,
  color?: string,
  activeBg?: string
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`relative p-2 rounded-xl flex items-center justify-center transition-all duration-200
        ${isActive ? activeBg : `${color} hover:bg-panvas-bg-hover hover:text-panvas-text-primary`}`}
    >
      {icon}
    </button>
  );
}
