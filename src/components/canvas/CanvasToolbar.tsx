import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Circle, Copy, Diamond, Download, Eraser, FileJson, Frame, Globe2, Hand,
  Image as ImageIcon, Library, Maximize2, Minus, Monitor, MoreHorizontal, MousePointer2,
  PanelTopClose, PanelTopOpen, PenTool, Redo2, Save, Settings2, Sparkles, Square, Sun,
  Moon, Type, Undo2, Upload, WandSparkles, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useUIStore } from '@/stores/uiStore';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { useDismissibleLayer } from '@/components/ui/useDismissibleLayer';
import { CANVAS_BACKGROUND_PRESETS, normalizeCanvasColor, toColorInputValue } from './canvasBackgrounds';
import { CanvasAudioControl } from './CanvasAudioControl';
import type { CanvasEditorThemeMode } from '@/services/canvas/canvasSceneState';

type ExportKind = 'excalidraw' | 'png' | 'svg' | 'clipboard';
interface CanvasToolbarProps {
  libraryManagerOpen: boolean;
  onToggleLibraryManager: () => void;
  drawToShapeEnabled: boolean;
  onToggleDrawToShape: () => void;
  onBackgroundColorChange: (color: string) => Promise<void>;
  editorThemeMode: CanvasEditorThemeMode;
  onEditorThemeModeChange: (mode: CanvasEditorThemeMode) => void;
  onSaveNow: () => Promise<void>;
  onImportScene: (file: File) => Promise<void>;
  onExport: (kind: ExportKind) => Promise<void>;
  onToggleFullscreen: () => Promise<void>;
  isFullscreen: boolean;
}

type ToolType = 'selection' | 'rectangle' | 'diamond' | 'ellipse' | 'arrow' | 'line' | 'freedraw' | 'text' | 'image' | 'eraser' | 'hand' | 'frame' | 'embeddable' | 'laser';
type ToolbarSnapshot = {
  activeTool: { type: ToolType; locked: boolean };
  gridSize: number | null;
  objectsSnapModeEnabled: boolean;
  isBindingEnabled: boolean;
  viewModeEnabled: boolean;
  zenModeEnabled: boolean;
  viewBackgroundColor: string;
  zoom?: { value: number } | number;
};
type CanvasAPI = {
  getAppState: () => ToolbarSnapshot;
  getSceneElements: () => readonly unknown[];
  onChange: (callback: (elements: readonly unknown[], state: ToolbarSnapshot) => void) => () => void;
  setActiveTool: (tool: { type: ToolType; locked?: boolean }) => void;
  updateScene: (scene: { appState: Partial<ToolbarSnapshot>; commitToHistory?: boolean }) => void;
  scrollToContent: (elements: readonly unknown[], options?: Record<string, unknown>) => void;
};

export function CanvasToolbar(props: CanvasToolbarProps) {
  const isPhone = useIsMobileViewport();
  const excalidrawAPI = useCanvasStore((state) => state.excalidrawAPI) as CanvasAPI | null;
  const [snapshot, setSnapshot] = useState<ToolbarSnapshot | null>(null);
  const [backgroundInputValue, setBackgroundInputValue] = useState('#ffffff');
  const [openPanel, setOpenPanel] = useState<'more' | 'settings' | 'file' | null>(null);
  const [toolbarHidden, setToolbarHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  useDismissibleLayer(openPanel === 'more', moreRef, useCallback(() => setOpenPanel(null), []));
  useDismissibleLayer(openPanel === 'settings', settingsRef, useCallback(() => setOpenPanel(null), []));
  useDismissibleLayer(openPanel === 'file', fileRef, useCallback(() => setOpenPanel(null), []));

  useEffect(() => {
    if (!excalidrawAPI) return;
    const update = (state: ToolbarSnapshot) => setSnapshot({
      activeTool: state.activeTool, gridSize: state.gridSize,
      objectsSnapModeEnabled: state.objectsSnapModeEnabled, isBindingEnabled: state.isBindingEnabled,
      viewModeEnabled: state.viewModeEnabled, zenModeEnabled: state.zenModeEnabled,
      viewBackgroundColor: state.viewBackgroundColor, zoom: state.zoom,
    });
    update(excalidrawAPI.getAppState());
    return excalidrawAPI.onChange((_elements, state) => update(state));
  }, [excalidrawAPI]);

  useEffect(() => { if (snapshot?.viewBackgroundColor) setBackgroundInputValue(snapshot.viewBackgroundColor); }, [snapshot?.viewBackgroundColor]);
  useEffect(() => { if (props.libraryManagerOpen) setOpenPanel(null); }, [props.libraryManagerOpen]);
  if (!excalidrawAPI || !snapshot) return null;
  if (toolbarHidden) return <button type="button" onClick={() => setToolbarHidden(false)} className="panvas-layer-toolbar panvas-floating-surface panvas-icon-control absolute left-1/2 top-4 h-9 w-9 -translate-x-1/2 rounded-full" title="Show canvas toolbar" aria-label="Show canvas toolbar"><PanelTopOpen size={16} /></button>;

  const setTool = (type: ToolType) => { excalidrawAPI.setActiveTool({ type, locked: snapshot.activeTool.locked }); setOpenPanel(null); };
  const updateAppState = (appState: Partial<ToolbarSnapshot>) => excalidrawAPI.updateScene({ appState, commitToHistory: false });
  const commitBackgroundColor = (value: string) => { const color = normalizeCanvasColor(value); if (color) { setBackgroundInputValue(color); void run(() => props.onBackgroundColorChange(color)); } };
  const dispatchHistoryShortcut = (key: 'z' | 'y') => document.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true }));
  const zoomValue = typeof snapshot.zoom === 'number' ? snapshot.zoom : snapshot.zoom?.value ?? 1;
  const setZoom = (value: number) => updateAppState({ zoom: { value: Math.max(0.1, Math.min(4, value)) } });
  const run = async (action: () => Promise<void>) => { setBusy(true); try { await action(); } catch { useUIStore.getState().showToast('Canvas action failed. Please retry.', 'error'); } finally { setBusy(false); } };
  const toggle = (panel: typeof openPanel) => {
    if (props.libraryManagerOpen) props.onToggleLibraryManager();
    setOpenPanel((current) => current === panel ? null : panel);
  };

  return <div className="panvas-canvas-toolbar panvas-layer-toolbar absolute left-1/2 top-4 -translate-x-1/2 animate-slide-in-up max-[599px]:max-w-[calc(100vw-1rem)]">
    <div className="relative flex items-center gap-0.5 rounded-2xl border border-panvas-border-strong bg-panvas-bg-elevated/95 p-1.5 shadow-glass backdrop-blur-xl max-[599px]:overflow-x-auto max-[599px]:scrollbar-none">
      <ToolButton icon={<MousePointer2 size={16} />} active={snapshot.activeTool.type === 'selection'} onClick={() => setTool('selection')} label="Select (V / 1)" />
      {!isPhone && <ToolButton icon={<Hand size={16} />} active={snapshot.activeTool.type === 'hand'} onClick={() => setTool('hand')} label="Pan (Space)" />}
      <Divider />
      <ToolButton icon={<PenTool size={16} />} active={snapshot.activeTool.type === 'freedraw'} onClick={() => setTool('freedraw')} label="Draw (P / 7)" />
      <ToolButton icon={<Eraser size={16} />} active={snapshot.activeTool.type === 'eraser'} onClick={() => setTool('eraser')} label="Eraser (E / 0)" />
      <Divider />
      {!isPhone && <><ToolButton icon={<Square size={16} />} active={snapshot.activeTool.type === 'rectangle'} onClick={() => setTool('rectangle')} label="Rectangle (R / 2)" />
      <ToolButton icon={<Diamond size={16} />} active={snapshot.activeTool.type === 'diamond'} onClick={() => setTool('diamond')} label="Diamond (D / 3)" />
      <ToolButton icon={<Circle size={16} />} active={snapshot.activeTool.type === 'ellipse'} onClick={() => setTool('ellipse')} label="Ellipse (O / 4)" />
      <ToolButton icon={<ArrowRight size={16} />} active={snapshot.activeTool.type === 'arrow'} onClick={() => setTool('arrow')} label="Arrow (A / 5)" />
      <ToolButton icon={<Minus size={16} />} active={snapshot.activeTool.type === 'line'} onClick={() => setTool('line')} label="Line (L / 6)" />
      </>}
      <ToolButton icon={<Type size={16} />} active={snapshot.activeTool.type === 'text'} onClick={() => setTool('text')} label="Text (T / 8)" />
      {!isPhone && <ToolButton icon={<ImageIcon size={16} />} active={snapshot.activeTool.type === 'image'} onClick={() => setTool('image')} label="Image (9)" />}
      <Divider />
      <div ref={moreRef} className="relative"><ToolButton icon={<MoreHorizontal size={16} />} active={openPanel === 'more'} onClick={() => toggle('more')} label="More canvas tools" expanded={openPanel === 'more'} />
        {openPanel === 'more' && <Menu label="More canvas tools">
          {isPhone && <>
            <MenuTool icon={<Hand size={16} />} label="Pan" onClick={() => setTool('hand')} />
            <MenuTool icon={<Square size={16} />} label="Rectangle" onClick={() => setTool('rectangle')} />
            <MenuTool icon={<Diamond size={16} />} label="Diamond" onClick={() => setTool('diamond')} />
            <MenuTool icon={<Circle size={16} />} label="Ellipse" onClick={() => setTool('ellipse')} />
            <MenuTool icon={<ArrowRight size={16} />} label="Arrow" onClick={() => setTool('arrow')} />
            <MenuTool icon={<Minus size={16} />} label="Line" onClick={() => setTool('line')} />
            <MenuTool icon={<ImageIcon size={16} />} label="Image" onClick={() => setTool('image')} />
            <MenuTool icon={<Library size={16} />} label="Canvas libraries" onClick={() => { props.onToggleLibraryManager(); setOpenPanel(null); }} />
            <MenuTool icon={<Download size={16} />} label="File and export" onClick={() => setOpenPanel('file')} />
            <MenuTool icon={<Settings2 size={16} />} label="Canvas settings" onClick={() => setOpenPanel('settings')} />
          </>}
          <MenuTool icon={<Frame size={16} />} label="Frame" shortcut="F" onClick={() => setTool('frame')} />
          <MenuTool icon={<Globe2 size={16} />} label="Secure web embed" onClick={() => setTool('embeddable')} />
          <MenuTool icon={<Sparkles size={16} />} label="Laser pointer" shortcut="K" onClick={() => setTool('laser')} />
          <MenuTool icon={<WandSparkles size={16} />} label="Draw to shape" active={props.drawToShapeEnabled} onClick={() => { props.onToggleDrawToShape(); setOpenPanel(null); }} />
          <div className="my-1 h-px bg-panvas-border-subtle" /><CanvasAudioControl />
        </Menu>}
      </div>
      {!isPhone && <ToolButton icon={<Library size={16} />} active={props.libraryManagerOpen} onClick={props.onToggleLibraryManager} label="Canvas libraries" />}
      <div ref={fileRef} className="relative"><span className="max-[599px]:hidden"><ToolButton icon={<Download size={16} />} active={openPanel === 'file'} onClick={() => toggle('file')} label="File and export" expanded={openPanel === 'file'} /></span>
        {openPanel === 'file' && <Menu label="File and export">
          <input ref={importRef} type="file" accept=".excalidraw,application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run(() => props.onImportScene(file)); }} />
          <MenuTool icon={<Save size={16} />} label="Save now" detail="Autosave is on" disabled={busy} onClick={() => void run(props.onSaveNow)} />
          <MenuTool icon={<Upload size={16} />} label="Import Excalidraw file" disabled={busy} onClick={() => importRef.current?.click()} />
          <div className="my-1 h-px bg-panvas-border-subtle" />
          <MenuTool icon={<FileJson size={16} />} label="Export editable file" disabled={busy} onClick={() => void run(() => props.onExport('excalidraw'))} />
          <MenuTool icon={<ImageIcon size={16} />} label="Export PNG" disabled={busy} onClick={() => void run(() => props.onExport('png'))} />
          <MenuTool icon={<Download size={16} />} label="Export SVG" disabled={busy} onClick={() => void run(() => props.onExport('svg'))} />
          <MenuTool icon={<Copy size={16} />} label="Copy PNG" disabled={busy} onClick={() => void run(() => props.onExport('clipboard'))} />
        </Menu>}
      </div>
      <div ref={settingsRef} className="relative"><span className="max-[599px]:hidden"><ToolButton icon={<Settings2 size={16} />} active={openPanel === 'settings'} onClick={() => toggle('settings')} label="Canvas settings" expanded={openPanel === 'settings'} /></span>
        {openPanel === 'settings' && <div className="absolute right-0 top-full mt-3 max-h-[min(70vh,36rem)] w-80 overflow-y-auto rounded-2xl border border-panvas-border-strong bg-panvas-bg-elevated p-3 shadow-glass-lg max-[599px]:w-[min(18rem,calc(100vw-1.5rem))]" role="dialog" aria-label="Canvas settings">
          <SettingSection title="Appearance">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-panvas-bg-secondary p-1">{([['system', <Monitor size={14} />, 'Follow app'], ['light', <Sun size={14} />, 'Light'], ['dark', <Moon size={14} />, 'Dark']] as const).map(([mode, icon, label]) => <button key={mode} type="button" onClick={() => props.onEditorThemeModeChange(mode)} aria-pressed={props.editorThemeMode === mode} className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs ${props.editorThemeMode === mode ? 'bg-panvas-bg-elevated text-panvas-text-primary shadow-sm' : 'text-panvas-text-secondary hover:text-panvas-text-primary'}`}>{icon}{label}</button>)}</div>
            <div className="mt-3 grid grid-cols-8 gap-1.5" role="list" aria-label="Canvas background presets">{CANVAS_BACKGROUND_PRESETS.map((preset) => <button key={preset.label} type="button" title={preset.label} aria-label={`${preset.label} canvas background`} aria-pressed={snapshot.viewBackgroundColor === preset.color} onClick={() => commitBackgroundColor(preset.color)} className={`h-7 rounded-md border ${snapshot.viewBackgroundColor === preset.color ? 'border-panvas-accent-blue ring-1 ring-panvas-accent-blue' : 'border-panvas-border-strong'}`} style={preset.color === 'transparent' ? { backgroundImage: 'linear-gradient(45deg,#aaa 25%,transparent 25%),linear-gradient(-45deg,#aaa 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#aaa 75%),linear-gradient(-45deg,transparent 75%,#aaa 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0,0 4px,4px -4px,-4px 0' } : { backgroundColor: preset.color }} />)}</div>
            <div className="mt-2 flex gap-2"><input type="color" aria-label="Choose custom canvas background color" value={toColorInputValue(backgroundInputValue)} onChange={(event) => commitBackgroundColor(event.target.value)} className="h-8 w-9 cursor-pointer rounded border border-panvas-border-strong bg-transparent p-0.5" /><input type="text" aria-label="Custom canvas background color" value={backgroundInputValue} onChange={(event) => setBackgroundInputValue(event.target.value)} onBlur={() => commitBackgroundColor(backgroundInputValue)} onKeyDown={(event) => { if (event.key === 'Enter') commitBackgroundColor(backgroundInputValue); }} className="min-w-0 flex-1 rounded-lg border border-panvas-border-strong bg-panvas-bg-secondary px-2 text-xs text-panvas-text-primary" /></div>
          </SettingSection>
          <SettingSection title="Grid & snapping">
            <label className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-panvas-text-secondary"><span className="flex-1"><span className="block">Grid and grid snap</span><span className="block text-xs text-panvas-text-tertiary">The installed engine links grid visibility and snapping.</span></span><select aria-label="Grid and grid snap" value={snapshot.gridSize ?? 0} onChange={(event) => updateAppState({ gridSize: Number(event.target.value) || null })} className="rounded-lg border border-panvas-border-strong bg-panvas-bg-secondary px-2 py-1.5 text-xs text-panvas-text-primary"><option value={0}>Off</option><option value={10}>10 px</option><option value={20}>20 px</option><option value={40}>40 px</option></select></label>
            <SettingToggle label="Snap to objects" checked={snapshot.objectsSnapModeEnabled} onChange={() => updateAppState({ objectsSnapModeEnabled: !snapshot.objectsSnapModeEnabled })} detail="Align edges and centers with nearby objects" />
          </SettingSection>
          <SettingSection title="Drawing"><SettingToggle label="Keep tool active" checked={snapshot.activeTool.locked} onChange={() => excalidrawAPI.setActiveTool({ type: snapshot.activeTool.type, locked: !snapshot.activeTool.locked })} /><SettingToggle label="Bind arrows to shapes" checked={snapshot.isBindingEnabled} onChange={() => updateAppState({ isBindingEnabled: !snapshot.isBindingEnabled })} /></SettingSection>
          <SettingSection title="View"><SettingToggle label="View mode" checked={snapshot.viewModeEnabled} onChange={() => updateAppState({ viewModeEnabled: !snapshot.viewModeEnabled })} /><SettingToggle label="Zen mode" checked={snapshot.zenModeEnabled} onChange={() => updateAppState({ zenModeEnabled: !snapshot.zenModeEnabled })} />
            <div className="mt-2 flex items-center gap-1"><button type="button" aria-label="Zoom out" onClick={() => setZoom(zoomValue - 0.1)} className="panvas-icon-control"><ZoomOut size={15} /></button><button type="button" onClick={() => setZoom(1)} className="flex-1 rounded-lg border border-panvas-border-strong px-2 py-1.5 text-xs text-panvas-text-primary">{Math.round(zoomValue * 100)}%</button><button type="button" aria-label="Zoom in" onClick={() => setZoom(zoomValue + 0.1)} className="panvas-icon-control"><ZoomIn size={15} /></button></div>
            <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => excalidrawAPI.scrollToContent(excalidrawAPI.getSceneElements(), { fitToViewport: true, viewportZoomFactor: 0.85, animate: true })} className="rounded-lg border border-panvas-border-strong px-2 py-2 text-xs text-panvas-text-primary hover:bg-panvas-bg-hover">Fit content</button><button type="button" onClick={() => void props.onToggleFullscreen()} className="flex items-center justify-center gap-1 rounded-lg border border-panvas-border-strong px-2 py-2 text-xs text-panvas-text-primary hover:bg-panvas-bg-hover"><Maximize2 size={14} />{props.isFullscreen ? 'Exit full screen' : 'Full screen'}</button></div>
          </SettingSection>
        </div>}
      </div>
      <Divider /><ToolButton icon={<Undo2 size={16} />} active={false} onClick={() => dispatchHistoryShortcut('z')} label="Undo (Ctrl+Z)" /><ToolButton icon={<Redo2 size={16} />} active={false} onClick={() => dispatchHistoryShortcut('y')} label="Redo (Ctrl+Y)" />
      {!isPhone && <><Divider /><ToolButton icon={<PanelTopClose size={16} />} active={false} onClick={() => { setToolbarHidden(true); setOpenPanel(null); }} label="Hide canvas toolbar" /></>}
    </div>
  </div>;
}

function Divider() { return <div className="mx-1 h-6 w-px bg-panvas-border-subtle" aria-hidden="true" />; }
function ToolButton({ icon, active, onClick, label, expanded }: { icon: React.ReactNode; active: boolean; onClick: () => void; label: string; expanded?: boolean }) { return <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active} aria-expanded={expanded} className={`flex items-center justify-center rounded-xl p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panvas-accent-blue ${active ? 'bg-panvas-bg-active text-panvas-text-primary' : 'text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary'}`}>{icon}</button>; }
function Menu({ label, children }: { label: string; children: React.ReactNode }) { return <div className="absolute right-0 top-full mt-3 w-64 rounded-xl border border-panvas-border-strong bg-panvas-bg-elevated p-2 shadow-glass-lg max-[599px]:w-[min(16rem,calc(100vw-1.5rem))]" role="menu" aria-label={label}>{children}</div>; }
function MenuTool({ icon, label, shortcut, detail, active = false, disabled = false, onClick }: { icon: React.ReactNode; label: string; shortcut?: string; detail?: string; active?: boolean; disabled?: boolean; onClick?: () => void }) { return <button type="button" role="menuitem" disabled={disabled} onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${active ? 'bg-panvas-bg-active text-panvas-text-primary' : 'text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary'} disabled:opacity-45`}>{icon}<span className="min-w-0 flex-1"><span className="block">{label}</span>{detail && <span className="block text-xs text-panvas-text-tertiary">{detail}</span>}</span>{shortcut && <span className="text-xs text-panvas-text-tertiary">{shortcut}</span>}</button>; }
function SettingSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-panvas-border-subtle py-3 first:pt-0 last:border-0 last:pb-0"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-panvas-text-tertiary">{title}</h3>{children}</section>; }
function SettingToggle({ label, checked, onChange, detail }: { label: string; checked: boolean; onChange: () => void; detail?: string }) { return <button type="button" role="switch" aria-checked={checked} onClick={onChange} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-panvas-bg-hover"><span className="flex-1 text-sm text-panvas-text-secondary"><span className="block">{label}</span>{detail && <span className="block text-xs text-panvas-text-tertiary">{detail}</span>}</span><span className={`h-5 w-9 rounded-full p-0.5 ${checked ? 'bg-panvas-accent-blue' : 'bg-panvas-bg-active'}`} aria-hidden="true"><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} /></span></button>; }
