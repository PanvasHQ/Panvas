import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, Italic, Underline, Heading1, Heading2, Heading3, 
  List, ListChecks, Quote, Code2, 
  PenTool, Pencil, Highlighter, Eraser, MousePointer2, Square, Circle, ArrowRight, Minus, Slash, Type, Hand,
  Undo2, Redo2, X, MoreHorizontal, PenTool as PenToolIcon, ChevronLeft, Maximize2, Minimize2, PanelLeft, PanelRight,
  Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, ListOrdered, Palette, PaintBucket, Image as ImageIcon
} from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { NotebookEngine } from './engine/NotebookEngine';
import type { ShapeType } from './engine/drawingTypes';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useLayoutStore } from '@/stores/layoutStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { notebookRepository } from '@/repositories/NotebookRepository';
import { OverlayManager } from '@/components/ui/OverlayManager';

const DRAWING_TOOLS = ['pen', 'pencil', 'highlighter', 'marker'] as const;
type DrawingTool = typeof DRAWING_TOOLS[number];

const DEFAULT_COLORS = [
  '#000000', '#333333', '#666666', '#999999',
  '#CC0000', '#FF4444', '#FF8800', '#FFCC00',
  '#00AA00', '#44CC44', '#0066CC', '#4488FF',
  '#6600CC', '#AA44FF', '#CC0066', '#FF4488',
];

interface ToolSettings {
  color: string;
  thickness: number;
  opacity: number;
  pressureSensitivity: boolean;
  stabilization: number;
}

const DEFAULT_TOOL_SETTINGS: Record<DrawingTool, ToolSettings> = {
  pen: { color: '#000000', thickness: 2.4, opacity: 100, pressureSensitivity: true, stabilization: 52 },
  pencil: { color: '#333333', thickness: 1.5, opacity: 85, pressureSensitivity: true, stabilization: 30 },
  highlighter: { color: '#FFCC00', thickness: 12, opacity: 40, pressureSensitivity: false, stabilization: 20 },
  marker: { color: '#CC0000', thickness: 5, opacity: 90, pressureSensitivity: false, stabilization: 40 },
};

interface EraserSettings {
  thickness: number;
  mode: 'pixel' | 'stroke';
}
const DEFAULT_ERASER_SETTINGS: EraserSettings = { thickness: 10, mode: 'stroke' };

interface NotebookFloatingToolbarProps {
  editor: Editor | null;
  engine: NotebookEngine;
  saveKey?: string; // Optional custom key for persistence (e.g. PDF composite key)
}

export const NotebookFloatingToolbar: React.FC<NotebookFloatingToolbarProps> = ({ editor, engine, saveKey }) => {
  const [activeTool, setActiveTool] = useState<string>('text');
  
  useEffect(() => {
    const unsub = engine.tools.subscribe((state) => {
      const tool = state.mode === 'draw' ? state.drawingTool : 
                   state.mode === 'shape' ? state.shapeTool : 
                   state.mode;
      setActiveTool(tool);
    });
    return unsub;
  }, [engine]);

  const [showPopup, setShowPopup] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  
  const { 
    notebookModeLevel, setNotebookModeLevel,
    isToolbarCollapsed, setToolbarCollapsed,
    toggleNotebookPane
  } = useLayoutStore();
  
  const [toolSettings, setToolSettings] = useState<Record<DrawingTool, ToolSettings>>(() => ({ ...DEFAULT_TOOL_SETTINGS }));
  const [eraserSettings, setEraserSettings] = useState<EraserSettings>(() => ({ ...DEFAULT_ERASER_SETTINGS }));
  
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const overflowAnchorRef = useRef<HTMLButtonElement>(null);
  
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);



  const isDrawingTool = (tool: string): tool is DrawingTool => DRAWING_TOOLS.includes(tool as DrawingTool);

  const handleToolClick = (toolId: string) => {
    if (isDrawingTool(toolId) || toolId === 'eraser') {
      if (activeTool === toolId) {
        setShowPopup(prev => !prev);
      } else {
        setShowPopup(true);
      }
    } else {
      setShowPopup(false);
    }

    // Set engine state directly
    if (toolId === 'select') {
      engine.tools.setMode('select');
    } else if (toolId === 'hand') {
      engine.tools.setMode('hand');
    } else if (toolId === 'text') {
      engine.tools.setMode('text');
    } else if (toolId === 'eraser') {
      if (eraserSettings.mode === 'stroke') {
        engine.tools.setEraserMode('stroke');
      } else {
        engine.tools.setDrawingTool('eraser');
        engine.tools.setThickness(eraserSettings.thickness);
        engine.tools.setOpacity(1);
      }
    } else if (['rectangle', 'ellipse', 'triangle', 'diamond', 'arrow', 'line'].includes(toolId)) {
      engine.tools.setShapeTool(toolId as any);
    } else if (isDrawingTool(toolId)) {
      engine.tools.setDrawingTool(toolId as any);
      const settings = toolSettings[toolId as DrawingTool];
      engine.tools.setColor(settings.color);
      engine.tools.setThickness(settings.thickness);
      engine.tools.setOpacity(settings.opacity / 100);
      engine.tools.setPressureSensitivity(settings.pressureSensitivity);
      engine.tools.setStabilization(settings.stabilization);
    }
  };

  const updateSetting = <K extends keyof ToolSettings>(key: K, value: ToolSettings[K]) => {
    if (!isDrawingTool(activeTool)) return;
    setToolSettings(prev => ({
      ...prev,
      [activeTool]: { ...prev[activeTool as DrawingTool], [key]: value },
    }));

    // Synchronously update engine
    if (key === 'thickness') {
      engine.tools.setThickness(value as number);
      engine.selection.changeThickness(value as number, activeTool);
    }
    if (key === 'opacity') {
      engine.tools.setOpacity((value as number) / 100);
      engine.selection.changeOpacity((value as number) / 100, activeTool);
    }
    if (key === 'color') {
      engine.tools.setColor(value as string);
      engine.selection.changeColor(value as string, activeTool);
    }
    if (key === 'pressureSensitivity') engine.tools.setPressureSensitivity(value as boolean);
    if (key === 'stabilization') engine.tools.setStabilization(value as number);
  };

  const currentSettings = isDrawingTool(activeTool) ? toolSettings[activeTool as DrawingTool] : null;

  if (isToolbarCollapsed) {
    return (
      <div className="flex items-start justify-center shadow-2xl rounded-xl">
        <button
          type="button"
          onClick={() => setToolbarCollapsed(false)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-panvas-bg-primary text-panvas-text-secondary hover:text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors shadow-lg border border-panvas-border-strong"
          title="Expand Toolbar"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
    );
  }

  const handleImageImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        document.body.removeChild(input);
        return;
      }
      console.log('[DEBUG] Image Tool: file selected:', file.name, file.type, file.size);

      const reader = new FileReader();
      reader.onload = async (re) => {
        const buffer = re.target?.result as ArrayBuffer;
        if (!buffer) return;
        console.log('[DEBUG] Image Tool: FileReader loaded buffer');

        const { activeWorkspaceId, activeNotebookId, activePageId } = useWorkspaceStore.getState();
        console.log('[DEBUG] Image Tool: activePageId:', activePageId);
        if (!activePageId && !saveKey) return;

        try {
          console.log('[DEBUG] Image Tool: canvasRepository.storeImage called');
          const { canvasRepository } = await import('@/repositories/CanvasRepository');
          const userId = useAuthStore.getState().user?.id || null;
          
          const mimeType = file.type || 'image/png';
          const effectivePageId = saveKey || activePageId;
          if (!effectivePageId) return;
          const imgData = await canvasRepository.storeImage(userId, effectivePageId, file.name, mimeType, buffer);
          console.log('[DEBUG] Image Tool: canvasRepository.storeImage SUCCESS, imgData:', imgData);
          
          const imgUrl = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
          const img = new Image();
          img.onload = () => {
            console.log('[DEBUG] Image Tool: Image onload triggered, calc width/height');
            let width = img.width;
            let height = img.height;
            const max = 450;
            if (width > max || height > max) {
              const ratio = Math.min(max / width, max / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            // Center on standard A4 / page bounds
            const pageX = 397;
            const pageY = 300;

            const newImg = {
              type: 'image' as const,
              id: imgData.id,
              x: Math.max(20, pageX - width / 2),
              y: Math.max(40, pageY - height / 2),
              width,
              height,
              fileId: imgData.id,
              rotation: 0,
              createdAt: Date.now()
            };
            console.log('[DEBUG] Image Tool: generated ImageObject:', newImg);

            engine.images.cacheImage(imgData.id, img);
            engine.images.addImage(newImg);
            engine.drawing.redraw();
            console.log('[DEBUG] Image Tool: redraw called');
            
            // Switch to select tool and highlight the inserted image
            engine.tools.setMode('select');
            engine.selection.clearSelection();
            engine.selection.selectAt(newImg.x + 10, newImg.y + 10, false);

            engine.history.pushExecuted({
              description: 'Insert image',
              execute: () => {
                engine.images.addImage(newImg);
                engine.drawing.redraw();
              },
              undo: () => {
                engine.images.removeImage(imgData.id);
                engine.drawing.redraw();
              }
            });

            // Immediate persistence
            console.log('[DEBUG] Image Tool: persistence called');
            if (activeWorkspaceId && activeNotebookId) {
              const effectivePageId = saveKey || activePageId;
              if (effectivePageId) {
                notebookRepository.saveDrawingData(activeWorkspaceId, activeNotebookId, effectivePageId, engine.getDrawingData());
              }
            }

            URL.revokeObjectURL(imgUrl);
          };
          img.onerror = (err) => {
            console.error('[DEBUG] Image Tool: Image onload FAILED', err);
          };
          img.src = imgUrl;

        } catch (err) {
          console.error('[DEBUG] Image Tool: failed to store image', err);
        }
      };
      reader.onerror = (err) => {
        console.error('[DEBUG] Image Tool: FileReader FAILED', err);
      };
      reader.readAsArrayBuffer(file);
      document.body.removeChild(input);
    };
    input.click();
  };

  const toolGroups = [
    {
      id: 'history',
      width: 98,
      items: [
        <ToolButton key="undo" icon={<Undo2 size={16} />} active={false} onClick={() => { if (activeTool === 'text') editor?.chain().focus().undo().run(); else engine.history.undo(); }} tooltip="Undo (Ctrl+Z)" />,
        <ToolButton key="redo" icon={<Redo2 size={16} />} active={false} onClick={() => { if (activeTool === 'text') editor?.chain().focus().redo().run(); else engine.history.redo(); }} tooltip="Redo (Ctrl+Y)" />
      ]
    },
    {
      id: 'select',
      width: 190,
      items: [
        <ToolButton key="hand" icon={<Hand size={16} />} active={activeTool === 'hand'} onClick={() => handleToolClick('hand')} tooltip="Hand (H)" />,
        <ToolButton key="select" icon={<MousePointer2 size={16} />} active={activeTool === 'select'} onClick={() => handleToolClick('select')} tooltip="Select (V)" />,
        <ToolButton key="text" icon={<Type size={16} />} active={activeTool === 'text'} onClick={() => handleToolClick('text')} tooltip="Text (T)" />,
        <ToolButton key="image" icon={<ImageIcon size={16} />} active={false} onClick={handleImageImport} tooltip="Insert Image" />
      ]
    },
    {
      id: 'draw',
      width: 230,
      items: [
        <ToolButton key="pen" icon={<PenTool size={16} />} active={activeTool === 'pen'} onClick={() => handleToolClick('pen')} tooltip="Pen (P)" hasPopup />,
        <ToolButton key="pencil" icon={<Pencil size={16} />} active={activeTool === 'pencil'} onClick={() => handleToolClick('pencil')} tooltip="Pencil (N)" hasPopup />,
        <ToolButton key="highlighter" icon={<Highlighter size={16} />} active={activeTool === 'highlighter'} onClick={() => handleToolClick('highlighter')} tooltip="Highlighter (H)" hasPopup />,
        <ToolButton key="marker" icon={<PenToolIcon size={16} />} active={activeTool === 'marker'} onClick={() => handleToolClick('marker')} tooltip="Marker (M)" hasPopup />,
        <ToolButton key="eraser" icon={<Eraser size={16} />} active={activeTool === 'eraser'} onClick={() => handleToolClick('eraser')} tooltip="Eraser (E)" hasPopup />
      ]
    },
    {
      id: 'shapes',
      width: 186,
      items: [
        <ToolButton key="rectangle" icon={<Square size={16} />} active={activeTool === 'rectangle'} onClick={() => handleToolClick('rectangle')} tooltip="Rectangle (R)" />,
        <ToolButton key="ellipse" icon={<Circle size={16} />} active={activeTool === 'ellipse'} onClick={() => handleToolClick('ellipse')} tooltip="Ellipse (O)" />,
        <ToolButton key="arrow" icon={<ArrowRight size={16} />} active={activeTool === 'arrow'} onClick={() => handleToolClick('arrow')} tooltip="Arrow (A)" />,
        <ToolButton key="line" icon={<Minus size={16} />} active={activeTool === 'line'} onClick={() => handleToolClick('line')} tooltip="Line (L)" />
      ]
    },
    {
      id: 'format',
      width: 54,
      items: [
        <FormatMenuTrigger key="format" editor={editor} engine={engine} activeTool={activeTool} />
      ]
    }
  ];

  let visibleCount = toolGroups.length;
  if (containerWidth) {
    const BASE_WIDTH = 90; // Padding + Hide button
    let currentWidth = BASE_WIDTH + 44; // +44 for overflow menu button
    for (let i = 0; i < toolGroups.length; i++) {
      if (currentWidth + toolGroups[i].width > containerWidth) {
        visibleCount = i;
        break;
      }
      currentWidth += toolGroups[i].width;
    }
    if (visibleCount === 0) visibleCount = 1; // Always show at least first group
  }

  const visibleGroups = toolGroups.slice(0, visibleCount);
  const overflowGroups = toolGroups.slice(visibleCount);

  return (
    <div 
      className="select-none min-w-0 w-full flex justify-center" 
      ref={containerRef}
    >
      <OverlayManager
        isOpen={showPopup && currentSettings !== null && activeTool !== 'eraser'}
        onClose={() => setShowPopup(false)}
        anchorRef={toolbarRef}
        placement="bottom-start"
      >
        <DrawingToolPopup
          toolName={activeTool}
          settings={currentSettings as ToolSettings}
          onUpdate={updateSetting}
          onClose={() => setShowPopup(false)}
        />
      </OverlayManager>

      <OverlayManager
        isOpen={showPopup && activeTool === 'eraser'}
        onClose={() => setShowPopup(false)}
        anchorRef={toolbarRef}
        placement="bottom-start"
      >
        <EraserPopup
          settings={eraserSettings}
          onUpdate={(key: keyof EraserSettings | 'mode', val: any) => setEraserSettings(s => ({ ...s, [key]: val }))}
          onClose={() => setShowPopup(false)}
        />
      </OverlayManager>

      <div ref={toolbarRef} className="flex justify-center items-center gap-1 rounded-2xl bg-panvas-bg-primary/95 backdrop-blur-xl px-3 py-2 shadow-2xl ring-1 ring-panvas-border-strong text-panvas-text-primary">
        
        {visibleGroups.map((group, index) => (
          <React.Fragment key={group.id}>
            {group.items}
            {index < visibleGroups.length - 1 && <Divider />}
          </React.Fragment>
        ))}

        {overflowGroups.length > 0 && (
          <>
            <Divider />
            <button
              ref={overflowAnchorRef}
              onClick={() => setShowOverflow(!showOverflow)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${showOverflow ? 'bg-panvas-bg-hover text-panvas-text-primary' : 'text-panvas-text-secondary hover:text-panvas-text-primary hover:bg-panvas-bg-hover'}`}
              title="More Tools"
            >
              <MoreHorizontal size={16} />
            </button>

            <OverlayManager isOpen={showOverflow} onClose={() => setShowOverflow(false)} anchorRef={overflowAnchorRef} placement="bottom-end">
              <div className="flex flex-col gap-2 p-2 bg-panvas-bg-primary/95 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-panvas-border-strong w-max">
                {overflowGroups.map((group, index) => (
                  <React.Fragment key={group.id}>
                    <div className="flex justify-center gap-1">
                      {group.items}
                    </div>
                    {index < overflowGroups.length - 1 && <div className="h-[1px] w-full bg-panvas-border-subtle my-1" />}
                  </React.Fragment>
                ))}
              </div>
            </OverlayManager>
          </>
        )}

        <Divider />
        <button onClick={() => setToolbarCollapsed(true)} className="flex items-center justify-center p-1.5 rounded-lg text-panvas-text-tertiary hover:text-panvas-text-primary hover:bg-panvas-bg-hover transition-colors" title="Hide Toolbar">
          <ChevronLeft size={16} />
        </button>
      </div>
    </div>
  );
};

function FormatMenuTrigger({ editor, engine, activeTool }: { editor: Editor | null, engine: any, activeTool: string }) {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  
  const applyTextCommand = (commandFn: (chain: any) => any) => {
    if (activeTool === 'select' && engine.selection.getSelectedElements().some((e: any) => e.type === 'text')) {
      const selectedTexts = engine.selection.getSelectedElements().filter((e: any) => e.type === 'text');
      let changed = false;
      for (const text of selectedTexts) {
        const textEditor = engine.texts.getEditor(text.id);
        if (textEditor) {
          commandFn(textEditor.chain().focus().selectAll()).run();
          changed = true;
        }
      }
      if (changed) return;
    }
    if (editor) {
      // If the user hasn't selected any text inside the editor, apply the format to the entire text box to avoid confusion
      if (editor.state.selection.empty) {
        commandFn(editor.chain().focus().selectAll()).run();
      } else {
        commandFn(editor.chain().focus()).run();
      }
    }
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setShowSlashMenu(prev => !prev)}
        className={`flex h-10 items-center justify-center p-1.5 rounded-lg transition-colors ${
          showSlashMenu ? 'bg-panvas-bg-hover text-panvas-text-primary' : 'text-panvas-text-secondary hover:text-panvas-text-primary hover:bg-panvas-bg-hover'
        }`}
        title="Text Formatting"
      >
        <span className="text-xs font-semibold px-1">Aa</span>
      </button>

      <OverlayManager isOpen={showSlashMenu} onClose={() => setShowSlashMenu(false)} anchorRef={anchorRef} placement="bottom-start">
        <div className="w-[260px] rounded-xl bg-panvas-bg-primary border border-panvas-border-strong shadow-2xl overflow-y-auto max-h-[60vh] py-2">
          <div className="px-3 pb-1 mb-1 border-b border-panvas-border-subtle text-2xs font-semibold text-panvas-text-tertiary uppercase tracking-wider">Style</div>
          <div className="flex justify-center gap-1 px-2 mb-2">
            <ToolButton icon={<Bold size={16} />} active={editor?.isActive('bold') ?? false} onClick={() => applyTextCommand(c => c.toggleBold())} tooltip="Bold (Ctrl+B)" />
            <ToolButton icon={<Italic size={16} />} active={editor?.isActive('italic') ?? false} onClick={() => applyTextCommand(c => c.toggleItalic())} tooltip="Italic (Ctrl+I)" />
            <ToolButton icon={<Underline size={16} />} active={editor?.isActive('underline') ?? false} onClick={() => applyTextCommand(c => c.toggleUnderline())} tooltip="Underline (Ctrl+U)" />
            <ToolButton icon={<Strikethrough size={16} />} active={editor?.isActive('strike') ?? false} onClick={() => applyTextCommand(c => c.toggleStrike())} tooltip="Strikethrough" />
          </div>

          <div className="px-3 pb-1 mb-1 mt-2 border-b border-panvas-border-subtle text-2xs font-semibold text-panvas-text-tertiary uppercase tracking-wider">Typography</div>
          <div className="px-2 mb-2 space-y-2">
            <div className="flex gap-2">
              <select 
                className="flex-1 rounded-md border border-panvas-border-default bg-panvas-bg-primary px-2 py-1 text-xs text-panvas-text-primary"
                value={editor?.getAttributes('textStyle').fontFamily || ''}
                onChange={e => e.target.value ? applyTextCommand(c => c.setFontFamily(e.target.value)) : applyTextCommand(c => c.unsetFontFamily())}
              >
                <optgroup label="Standard">
                  <option value="" style={{ fontFamily: 'Inter, sans-serif' }}>Default Font (Inter)</option>
                  <option value="'Times New Roman', serif" style={{ fontFamily: "'Times New Roman', serif" }}>Times New Roman</option>
                  <option value="'Courier New', monospace" style={{ fontFamily: "'Courier New', monospace" }}>Courier New</option>
                  <option value="'Comic Sans MS', cursive" style={{ fontFamily: "'Comic Sans MS', cursive" }}>Comic Sans</option>
                </optgroup>
                <optgroup label="Handwriting">
                  <option value="'Patrick Hand', cursive" style={{ fontFamily: "'Patrick Hand', cursive" }}>Clean Handwriting</option>
                  <option value="'Kalam', cursive" style={{ fontFamily: "'Kalam', cursive" }}>Casual Handwriting</option>
                  <option value="'Permanent Marker', cursive" style={{ fontFamily: "'Permanent Marker', cursive" }}>Marker</option>
                  <option value="'Shadows Into Light', cursive" style={{ fontFamily: "'Shadows Into Light', cursive" }}>Notebook</option>
                  <option value="'Caveat', cursive" style={{ fontFamily: "'Caveat', cursive", fontSize: '1.2em' }}>Calligraphy</option>
                </optgroup>
              </select>
              <select 
                className="w-20 rounded-md border border-panvas-border-default bg-panvas-bg-primary px-2 py-1 text-xs text-panvas-text-primary"
                value={editor?.getAttributes('textStyle').fontSize || ''}
                onChange={e => e.target.value ? applyTextCommand(c => c.setFontSize(e.target.value)) : applyTextCommand(c => c.unsetFontSize())}
              >
                <option value="">Size</option>
                <option value="12px">12px</option>
                <option value="14px">14px</option>
                <option value="16px">16px</option>
                <option value="20px">20px</option>
                <option value="24px">24px</option>
                <option value="32px">32px</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Palette size={14} className="text-panvas-text-secondary" />
                <span className="text-xs text-panvas-text-secondary">Text</span>
              </div>
              <input 
                type="color" 
                value={editor?.getAttributes('textStyle').color || '#000000'}
                onChange={e => applyTextCommand(c => c.setColor(e.target.value))}
                className="w-6 h-6 p-0 border border-panvas-border-default rounded cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <PaintBucket size={14} className="text-panvas-text-secondary" />
                <span className="text-xs text-panvas-text-secondary">Highlight</span>
              </div>
              <input 
                type="color" 
                value={editor?.getAttributes('highlight').color || '#ffffff'}
                onChange={e => applyTextCommand(c => c.toggleHighlight({ color: e.target.value }))}
                className="w-6 h-6 p-0 border border-panvas-border-default rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="px-3 pb-1 mb-1 mt-2 border-b border-panvas-border-subtle text-2xs font-semibold text-panvas-text-tertiary uppercase tracking-wider">Alignment</div>
          <div className="flex justify-center gap-1 px-2 mb-2">
            <ToolButton icon={<AlignLeft size={16} />} active={editor?.isActive({ textAlign: 'left' }) ?? false} onClick={() => applyTextCommand(c => c.setTextAlign('left'))} tooltip="Align Left" />
            <ToolButton icon={<AlignCenter size={16} />} active={editor?.isActive({ textAlign: 'center' }) ?? false} onClick={() => applyTextCommand(c => c.setTextAlign('center'))} tooltip="Align Center" />
            <ToolButton icon={<AlignRight size={16} />} active={editor?.isActive({ textAlign: 'right' }) ?? false} onClick={() => applyTextCommand(c => c.setTextAlign('right'))} tooltip="Align Right" />
            <ToolButton icon={<AlignJustify size={16} />} active={editor?.isActive({ textAlign: 'justify' }) ?? false} onClick={() => applyTextCommand(c => c.setTextAlign('justify'))} tooltip="Justify" />
          </div>

          <div className="px-3 pb-1 mb-1 mt-2 border-b border-panvas-border-subtle text-2xs font-semibold text-panvas-text-tertiary uppercase tracking-wider">Headings</div>
          <div className="flex justify-center gap-1 px-2 mb-2">
            <ToolButton icon={<span className="font-bold">H1</span>} active={editor?.isActive('heading', { level: 1 }) ?? false} onClick={() => applyTextCommand(c => c.toggleHeading({ level: 1 }))} tooltip="Heading 1" />
            <ToolButton icon={<span className="font-bold">H2</span>} active={editor?.isActive('heading', { level: 2 }) ?? false} onClick={() => applyTextCommand(c => c.toggleHeading({ level: 2 }))} tooltip="Heading 2" />
            <ToolButton icon={<span className="font-bold">H3</span>} active={editor?.isActive('heading', { level: 3 }) ?? false} onClick={() => applyTextCommand(c => c.toggleHeading({ level: 3 }))} tooltip="Heading 3" />
          </div>
          
          <div className="px-3 pb-1 mb-1 mt-2 border-b border-panvas-border-subtle text-2xs font-semibold text-panvas-text-tertiary uppercase tracking-wider">Blocks</div>
          <div className="flex justify-center gap-1 px-2 mb-2">
            <ToolButton icon={<List size={16} />} active={editor?.isActive('bulletList') ?? false} onClick={() => applyTextCommand(c => c.toggleBulletList())} tooltip="Bullet List" />
            <ToolButton icon={<ListOrdered size={16} />} active={editor?.isActive('orderedList') ?? false} onClick={() => applyTextCommand(c => c.toggleOrderedList())} tooltip="Numbered List" />
            <ToolButton icon={<ListChecks size={16} />} active={editor?.isActive('taskList') ?? false} onClick={() => applyTextCommand(c => c.toggleTaskList())} tooltip="Checklist" />
            <ToolButton icon={<Quote size={16} />} active={editor?.isActive('blockquote') ?? false} onClick={() => applyTextCommand(c => c.toggleBlockquote())} tooltip="Quote" />
            <ToolButton icon={<Code2 size={16} />} active={editor?.isActive('codeBlock') ?? false} onClick={() => applyTextCommand(c => c.toggleCodeBlock())} tooltip="Code Block" />
          </div>
        </div>
      </OverlayManager>
    </>
  );
}

// ─── Drawing Tool Settings Popup ───────────────────────────────────────────────

function DrawingToolPopup({ toolName, settings, onUpdate, onClose }: {
  toolName: string;
  settings: ToolSettings;
  onUpdate: <K extends keyof ToolSettings>(key: K, value: ToolSettings[K]) => void;
  onClose: () => void;
}) {
  const toolLabel = toolName.charAt(0).toUpperCase() + toolName.slice(1);

  return (
    <div className="w-[420px] rounded-2xl bg-panvas-bg-primary border border-panvas-border-strong shadow-2xl backdrop-blur-xl overflow-hidden text-panvas-text-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-panvas-border-subtle bg-panvas-bg-secondary/50">
        <span className="text-sm font-semibold text-panvas-text-primary">{toolLabel} Settings</span>
        <button onClick={onClose} className="text-panvas-text-secondary hover:text-panvas-text-primary transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-0">
        {/* Left: Stroke Settings */}
        <div className="p-4 border-r border-panvas-border-subtle space-y-4">
          <div className="text-2xs font-semibold uppercase tracking-widest text-panvas-text-secondary">Stroke Style</div>

          {/* Thickness */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-panvas-text-secondary">Thickness</span>
              <span className="text-panvas-text-tertiary">{settings.thickness.toFixed(1)} mm</span>
            </div>
            <input
              type="range" min="0.5" max="20" step="0.1"
              value={settings.thickness}
              onChange={e => onUpdate('thickness', parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full bg-panvas-border-default appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Opacity */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-panvas-text-secondary">Opacity</span>
              <span className="text-panvas-text-tertiary">{settings.opacity}%</span>
            </div>
            <input
              type="range" min="5" max="100" step="1"
              value={settings.opacity}
              onChange={e => onUpdate('opacity', parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full bg-panvas-border-default appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Stabilization */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-panvas-text-secondary">Stabilization</span>
              <span className="text-panvas-text-tertiary">{settings.stabilization}%</span>
            </div>
            <input
              type="range" min="0" max="100" step="1"
              value={settings.stabilization}
              onChange={e => onUpdate('stabilization', parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full bg-panvas-border-default appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Brush Preview */}
          <div className="rounded-lg bg-panvas-bg-secondary p-2.5 border border-panvas-border-subtle">
            <div className="text-2xs text-panvas-text-tertiary mb-1">Preview</div>
            <svg className="w-full h-8" viewBox="0 0 200 32" fill="none">
              <path
                d="M4 24C30 4 55 28 90 14S140 6 196 20"
                stroke={settings.color}
                strokeWidth={Math.min(settings.thickness, 6)}
                strokeLinecap="round"
                opacity={settings.opacity / 100}
              />
            </svg>
          </div>
        </div>

        {/* Right: Color & Pressure */}
        <div className="p-4 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-2xs font-semibold uppercase tracking-widest text-panvas-text-secondary">Colors</div>
            <input 
              type="color" 
              value={settings.color} 
              onChange={e => onUpdate('color', e.target.value)} 
              className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {DEFAULT_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => onUpdate('color', color)}
                className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  settings.color === color
                    ? 'border-blue-500 ring-2 ring-blue-500/30 scale-110'
                    : 'border-panvas-border-strong hover:border-panvas-text-primary'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* Pressure Sensitivity */}
          <div className="mt-3">
            <div className="text-2xs font-semibold uppercase tracking-widest text-panvas-text-secondary mb-2">Pressure Sensitivity</div>
            <button
              type="button"
              onClick={() => onUpdate('pressureSensitivity', !settings.pressureSensitivity)}
              className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors border ${
                settings.pressureSensitivity
                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                  : 'bg-panvas-bg-secondary text-panvas-text-secondary border-panvas-border-subtle'
              }`}
            >
              <span>{settings.pressureSensitivity ? 'Enabled' : 'Disabled'}</span>
              <div className={`w-8 h-4 rounded-full transition-colors ${settings.pressureSensitivity ? 'bg-blue-500' : 'bg-panvas-border-strong'}`}>
                <div className={`h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform mt-[1px] ${settings.pressureSensitivity ? 'translate-x-[17px]' : 'translate-x-[1px]'}`} />
              </div>
            </button>
          </div>

          {/* Pressure Curve Preview */}
          <div className="rounded-lg bg-panvas-bg-secondary p-2.5 border border-panvas-border-subtle">
            <div className="text-2xs text-panvas-text-tertiary mb-1">Test Area</div>
            <svg className="w-full h-10" viewBox="0 0 180 40" fill="none">
              <path
                d="M8 32C40 28 60 8 90 12S140 30 172 10"
                stroke={settings.color}
                strokeWidth={settings.pressureSensitivity ? '2' : String(Math.min(settings.thickness, 4))}
                strokeLinecap="round"
                opacity={settings.opacity / 100}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function EraserPopup({ settings, onUpdate, onClose }: {
  settings: EraserSettings & { mode?: 'pixel' | 'stroke' };
  onUpdate: (key: keyof EraserSettings | 'mode', value: any) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-[260px] rounded-2xl bg-panvas-bg-primary border border-panvas-border-strong shadow-2xl backdrop-blur-xl overflow-hidden text-panvas-text-primary">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panvas-border-subtle bg-panvas-bg-secondary/50">
        <span className="text-sm font-semibold">Eraser Settings</span>
        <button onClick={onClose} className="text-panvas-text-secondary hover:text-panvas-text-primary transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {/* Erase Mode */}
        <div>
          <div className="text-xs mb-1.5 text-panvas-text-secondary">Mode</div>
          <div className="flex rounded-md border border-panvas-border-subtle bg-panvas-bg-secondary p-1">
            <button
              onClick={() => onUpdate('mode', 'pixel')}
              className={`flex-1 rounded text-xs py-1 transition-colors ${settings.mode !== 'stroke' ? 'bg-panvas-bg-primary shadow text-panvas-text-primary font-medium' : 'text-panvas-text-secondary'}`}
            >
              Pixel Eraser
            </button>
            <button
              onClick={() => onUpdate('mode', 'stroke')}
              className={`flex-1 rounded text-xs py-1 transition-colors ${settings.mode === 'stroke' ? 'bg-panvas-bg-primary shadow text-panvas-text-primary font-medium' : 'text-panvas-text-secondary'}`}
            >
              Stroke Eraser
            </button>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-panvas-text-secondary">Size</span>
            <span className="text-panvas-text-tertiary">{settings.thickness.toFixed(1)} mm</span>
          </div>
          <input
            type="range" min="2" max="50" step="0.5"
            value={settings.thickness}
            onChange={e => onUpdate('thickness', parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full bg-panvas-border-default appearance-none cursor-pointer accent-blue-500"
          />
        </div>
        <div className="rounded-lg bg-panvas-bg-secondary border border-panvas-border-subtle p-3 flex items-center justify-center">
          <div 
            className="rounded-full border-2 border-panvas-border-strong bg-panvas-bg-primary"
            style={{ width: Math.min(settings.thickness * 3, 80), height: Math.min(settings.thickness * 3, 80) }}
          />
        </div>
      </div>
    </div>
  );
}

function ToolButton({ icon, active, onClick, tooltip, hasPopup }: { icon: React.ReactNode; active: boolean; onClick: () => void; tooltip: string; hasPopup?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      className={`relative flex h-10 w-10 p-2 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-150 ${
        active 
          ? 'bg-blue-500/10 text-blue-500 font-bold shadow-sm ring-1 ring-blue-500/50' 
          : 'text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary active:scale-95'
      }`}
    >
      <div className="pointer-events-none flex items-center justify-center w-full h-full">
        {icon}
      </div>
      {hasPopup && active && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full bg-blue-400" />
      )}
    </button>
  );
}

function Divider() {
  return <div className="w-[1px] h-5 bg-panvas-border-subtle mx-1 flex-shrink-0" />;
}
