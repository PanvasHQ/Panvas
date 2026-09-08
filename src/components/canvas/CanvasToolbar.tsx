import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Circle, Diamond, Eraser, Frame, Globe2, Hand, Image as ImageIcon,
  LassoSelect, Library, Minus, MoreHorizontal, MousePointer2, PaintBucket, PenTool,
  PanelTopClose, PanelTopOpen, Redo2, Settings2, Sparkles, Square, Type, Undo2, WandSparkles,
} from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useDismissibleLayer } from '@/components/ui/useDismissibleLayer';
import { CANVAS_BACKGROUND_PRESETS, normalizeCanvasColor, toColorInputValue } from './canvasBackgrounds';
import { CanvasAudioControl } from './CanvasAudioControl';

interface CanvasToolbarProps {
  libraryManagerOpen: boolean;
  onToggleLibraryManager: () => void;
  drawToShapeEnabled: boolean;
  onToggleDrawToShape: () => void;
  onLassoSelect: () => void;
  onBackgroundColorChange: (color: string) => void;
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
};
type CanvasAPI = {
  getAppState: () => ToolbarSnapshot;
  onChange: (callback: (elements: readonly unknown[], state: ToolbarSnapshot) => void) => () => void;
  setActiveTool: (tool: { type: ToolType; locked?: boolean }) => void;
  updateScene: (scene: { appState: Partial<ToolbarSnapshot>; commitToHistory?: boolean }) => void;
};

export function CanvasToolbar({
  libraryManagerOpen,
  onToggleLibraryManager,
  drawToShapeEnabled,
  onToggleDrawToShape,
  onLassoSelect,
  onBackgroundColorChange,
}: CanvasToolbarProps) {
  const excalidrawAPI = useCanvasStore((state) => state.excalidrawAPI) as CanvasAPI | null;
  const [snapshot, setSnapshot] = useState<ToolbarSnapshot | null>(null);
  const [backgroundInputValue, setBackgroundInputValue] = useState('#ffffff');
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolbarHidden, setToolbarHidden] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  useDismissibleLayer(moreOpen, moreRef, closeMore);
  useDismissibleLayer(settingsOpen, settingsRef, closeSettings);

  useEffect(() => {
    if (!excalidrawAPI) return;
    const update = (state: ToolbarSnapshot) => setSnapshot({
      activeTool: state.activeTool,
      gridSize: state.gridSize,
      objectsSnapModeEnabled: state.objectsSnapModeEnabled,
      isBindingEnabled: state.isBindingEnabled,
      viewModeEnabled: state.viewModeEnabled,
      zenModeEnabled: state.zenModeEnabled,
      viewBackgroundColor: state.viewBackgroundColor,
    });
    update(excalidrawAPI.getAppState());
    return excalidrawAPI.onChange((_elements, state) => update(state));
  }, [excalidrawAPI]);

  // Keep the editable field synchronized with the authoritative Excalidraw
  // appState while still allowing users to type an intermediate (temporarily
  // invalid) hex value before it is committed.
  useEffect(() => {
    if (snapshot?.viewBackgroundColor) {
      setBackgroundInputValue(snapshot.viewBackgroundColor);
    }
  }, [snapshot?.viewBackgroundColor]);

  if (!excalidrawAPI || !snapshot) return null;

  if (toolbarHidden) {
    return <button type="button" onClick={() => setToolbarHidden(false)} className="panvas-layer-toolbar panvas-floating-surface panvas-icon-control absolute left-1/2 top-4 h-8 w-8 -translate-x-1/2 rounded-full" title="Show canvas toolbar" aria-label="Show canvas toolbar"><PanelTopOpen size={15} /></button>;
  }

  const setTool = (type: ToolType) => {
    excalidrawAPI.setActiveTool({ type, locked: snapshot.activeTool.locked });
    setMoreOpen(false);
  };
  const updateAppState = (appState: Partial<ToolbarSnapshot>) => excalidrawAPI.updateScene({ appState, commitToHistory: false });
  const commitBackgroundColor = (value: string) => {
    const normalized = normalizeCanvasColor(value);
    if (!normalized) return;
    setBackgroundInputValue(normalized);
    onBackgroundColorChange(normalized);
  };
  const dispatchHistoryShortcut = (key: 'z' | 'y') => document.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true }));

  return (
    <div className="panvas-layer-toolbar absolute top-4 left-1/2 -translate-x-1/2 animate-slide-in-up max-[599px]:max-w-[calc(100vw-1rem)]">
      <div className="relative flex items-center gap-1 rounded-2xl border border-panvas-border-strong bg-panvas-bg-elevated p-1.5 shadow-glass max-[599px]:overflow-x-auto max-[599px]:scrollbar-none">
        <ToolButton icon={<MousePointer2 size={16} />} isActive={snapshot.activeTool.type === 'selection'} onClick={() => setTool('selection')} tooltip="Select (V / 1)" />
        <ToolButton icon={<Hand size={16} />} isActive={snapshot.activeTool.type === 'hand'} onClick={() => setTool('hand')} tooltip="Pan (Space)" />
        <Divider />
        <ToolButton icon={<PenTool size={16} />} isActive={snapshot.activeTool.type === 'freedraw'} onClick={() => setTool('freedraw')} tooltip="Draw (P / 7)" color="text-panvas-accent-violet" activeBg="bg-panvas-accent-violet text-white" />
        <ToolButton icon={<Eraser size={16} />} isActive={snapshot.activeTool.type === 'eraser'} onClick={() => setTool('eraser')} tooltip="Eraser (E / 0)" />
        <Divider />
        <ToolButton icon={<Square size={16} />} isActive={snapshot.activeTool.type === 'rectangle'} onClick={() => setTool('rectangle')} tooltip="Rectangle (R / 2)" />
        <ToolButton icon={<Diamond size={16} />} isActive={snapshot.activeTool.type === 'diamond'} onClick={() => setTool('diamond')} tooltip="Diamond (D / 3)" />
        <ToolButton icon={<Circle size={16} />} isActive={snapshot.activeTool.type === 'ellipse'} onClick={() => setTool('ellipse')} tooltip="Ellipse (O / 4)" />
        <ToolButton icon={<ArrowRight size={16} />} isActive={snapshot.activeTool.type === 'arrow'} onClick={() => setTool('arrow')} tooltip="Arrow (A / 5)" />
        <ToolButton icon={<Minus size={16} />} isActive={snapshot.activeTool.type === 'line'} onClick={() => setTool('line')} tooltip="Line (L / 6)" />
        <ToolButton icon={<Type size={16} />} isActive={snapshot.activeTool.type === 'text'} onClick={() => setTool('text')} tooltip="Text (T / 8)" />
        <ToolButton icon={<ImageIcon size={16} />} isActive={snapshot.activeTool.type === 'image'} onClick={() => setTool('image')} tooltip="Image (9)" />
        <Divider />
        <div ref={moreRef} className="relative">
          <ToolButton icon={<MoreHorizontal size={16} />} isActive={moreOpen || ['frame', 'embeddable', 'laser'].includes(snapshot.activeTool.type)} onClick={() => { setMoreOpen((open) => !open); setSettingsOpen(false); }} tooltip="More canvas tools" ariaExpanded={moreOpen} />
          <div className={`${moreOpen ? '' : 'hidden'} absolute left-1/2 top-full mt-3 w-64 -translate-x-1/2 rounded-xl border border-panvas-border-strong bg-panvas-bg-elevated p-2 shadow-glass-lg max-[599px]:left-auto max-[599px]:right-0 max-[599px]:translate-x-0 max-[599px]:w-[min(16rem,calc(100vw-1.5rem))]`} role="menu" aria-label="More canvas tools">
              <MenuTool icon={<Frame size={16} />} label="Frame tool" shortcut="F" active={snapshot.activeTool.type === 'frame'} onClick={() => setTool('frame')} />
              <MenuTool icon={<Globe2 size={16} />} label="Web embed" active={snapshot.activeTool.type === 'embeddable'} onClick={() => setTool('embeddable')} />
              <MenuTool icon={<Sparkles size={16} />} label="Laser pointer" shortcut="K" active={snapshot.activeTool.type === 'laser'} onClick={() => setTool('laser')} />
              <div className="my-2 h-px bg-panvas-border-subtle" />
              <MenuTool icon={<LassoSelect size={16} />} label="Lasso selection" shortcut="V / 1" active={snapshot.activeTool.type === 'selection'} onClick={() => { onLassoSelect(); setMoreOpen(false); }} />
              <MenuTool icon={<WandSparkles size={16} />} label="Draw to shape" active={drawToShapeEnabled} onClick={() => { onToggleDrawToShape(); setMoreOpen(false); }} />
              <MenuTool icon={<PaintBucket size={16} />} label="Bucket fill" disabled title="Bucket fill is not available in the bundled Excalidraw engine." />
              <div className="my-2 h-px bg-panvas-border-subtle" />
              <CanvasAudioControl />
            </div>
        </div>
        <ToolButton icon={<Library size={16} />} isActive={libraryManagerOpen} onClick={onToggleLibraryManager} tooltip="Canvas libraries" />
        <div ref={settingsRef} className="relative">
          <ToolButton icon={<Settings2 size={16} />} isActive={settingsOpen} onClick={() => { setSettingsOpen((open) => !open); setMoreOpen(false); }} tooltip="Canvas settings" ariaExpanded={settingsOpen} />
          {settingsOpen && (
            <div className="absolute right-0 top-full mt-3 w-72 rounded-xl border border-panvas-border-strong bg-panvas-bg-elevated p-3 shadow-glass-lg max-[599px]:w-[min(18rem,calc(100vw-1.5rem))]" role="dialog" aria-label="Canvas settings">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-panvas-text-tertiary">Canvas settings</div>
              <label className="block py-2 text-sm text-panvas-text-secondary">
                <span className="mb-1 block">Grid</span>
                <select value={snapshot.gridSize ?? 0} onChange={(event) => updateAppState({ gridSize: Number(event.target.value) || null })} className="w-full rounded-lg border border-panvas-border-strong bg-panvas-bg-secondary px-2 py-1.5 text-panvas-text-primary">
                  <option value={0}>Off</option><option value={10}>Small</option><option value={20}>Normal</option>
                </select>
              </label>
              <SettingToggle label="Snap to objects" shortcut="Alt+S" checked={snapshot.objectsSnapModeEnabled} onChange={() => updateAppState({ objectsSnapModeEnabled: !snapshot.objectsSnapModeEnabled })} />
              <SettingToggle label="Snap to midpoints" checked={snapshot.objectsSnapModeEnabled} onChange={() => updateAppState({ objectsSnapModeEnabled: !snapshot.objectsSnapModeEnabled })} detail="Snap edges and centers to nearby objects" />
              <SettingToggle label="Tool lock" shortcut="Q" checked={snapshot.activeTool.locked} onChange={() => excalidrawAPI.setActiveTool({ type: snapshot.activeTool.type as ToolType, locked: !snapshot.activeTool.locked })} />
              <SettingToggle label="Arrow binding" checked={snapshot.isBindingEnabled} onChange={() => updateAppState({ isBindingEnabled: !snapshot.isBindingEnabled })} />
              <SettingToggle label="View mode" shortcut="Alt+R" checked={snapshot.viewModeEnabled} onChange={() => updateAppState({ viewModeEnabled: !snapshot.viewModeEnabled })} />
              <SettingToggle label="Zen mode" shortcut="Alt+Z" checked={snapshot.zenModeEnabled} onChange={() => updateAppState({ zenModeEnabled: !snapshot.zenModeEnabled })} />
              <div className="mt-2 border-t border-panvas-border-subtle pt-3">
                <div className="mb-2 text-sm text-panvas-text-secondary">Canvas background</div>
                <div className="grid grid-cols-5 gap-2" role="list" aria-label="Canvas background presets">
                  {CANVAS_BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      title={preset.label}
                      aria-label={`${preset.label} canvas background`}
                      aria-pressed={snapshot.viewBackgroundColor === preset.color}
                      onClick={() => commitBackgroundColor(preset.color)}
                      className={`h-8 rounded-md border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panvas-accent-blue ${snapshot.viewBackgroundColor === preset.color ? 'border-panvas-accent-blue ring-1 ring-panvas-accent-blue' : 'border-panvas-border-strong'}`}
                      style={preset.color === 'transparent'
                        ? { backgroundImage: 'linear-gradient(45deg, #9ca3af 25%, transparent 25%), linear-gradient(-45deg, #9ca3af 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #9ca3af 75%), linear-gradient(-45deg, transparent 75%, #9ca3af 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px' }
                        : { backgroundColor: preset.color }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Choose custom canvas background color"
                    value={toColorInputValue(backgroundInputValue)}
                    onChange={(event) => commitBackgroundColor(event.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-panvas-border-strong bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    aria-label="Custom canvas background color"
                    value={backgroundInputValue}
                    onChange={(event) => {
                      const rawValue = event.target.value;
                      setBackgroundInputValue(rawValue);
                      const color = normalizeCanvasColor(rawValue);
                      if (color) commitBackgroundColor(color);
                    }}
                    onBlur={() => setBackgroundInputValue(snapshot.viewBackgroundColor)}
                    placeholder="#ffffff or transparent"
                    className="min-w-0 flex-1 rounded-lg border border-panvas-border-strong bg-panvas-bg-secondary px-2 py-1.5 text-xs text-panvas-text-primary"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        <Divider />
        <ToolButton icon={<Undo2 size={16} />} isActive={false} onClick={() => dispatchHistoryShortcut('z')} tooltip="Undo (Ctrl+Z)" />
        <ToolButton icon={<Redo2 size={16} />} isActive={false} onClick={() => dispatchHistoryShortcut('y')} tooltip="Redo (Ctrl+Y)" />
        <Divider />
        <ToolButton icon={<PanelTopClose size={16} />} isActive={false} onClick={() => { setToolbarHidden(true); setMoreOpen(false); setSettingsOpen(false); }} tooltip="Hide canvas toolbar" />
      </div>
    </div>
  );
}

function Divider() { return <div className="mx-1 h-6 w-px bg-panvas-border-subtle" aria-hidden="true" />; }

function ToolButton({ icon, isActive, onClick, tooltip, color = 'text-panvas-text-secondary', activeBg = 'bg-panvas-bg-active text-panvas-text-primary', ariaExpanded }: { icon: React.ReactNode; isActive: boolean; onClick: () => void; tooltip: string; color?: string; activeBg?: string; ariaExpanded?: boolean }) {
  return <button type="button" onClick={onClick} title={tooltip} aria-label={tooltip} aria-pressed={isActive} aria-expanded={ariaExpanded} className={`relative flex items-center justify-center rounded-xl p-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panvas-accent-blue ${isActive ? activeBg : `${color} hover:bg-panvas-bg-hover hover:text-panvas-text-primary`}`}>{icon}</button>;
}

function MenuTool({ icon, label, shortcut, active = false, disabled = false, title, onClick }: { icon: React.ReactNode; label: string; shortcut?: string; active?: boolean; disabled?: boolean; title?: string; onClick?: () => void }) {
  return <button type="button" role="menuitem" disabled={disabled} title={title} onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${active ? 'bg-panvas-bg-active text-panvas-text-primary' : 'text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary'} disabled:cursor-not-allowed disabled:opacity-45`}>{icon}<span className="flex-1">{label}</span>{shortcut && <span className="text-xs text-panvas-text-tertiary">{shortcut}</span>}</button>;
}

function SettingToggle({ label, shortcut, checked, onChange, disabled = false, detail }: { label: string; shortcut?: string; checked: boolean; onChange?: () => void; disabled?: boolean; detail?: string }) {
  return <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={onChange} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-panvas-bg-hover disabled:cursor-not-allowed disabled:opacity-45"><span className="flex-1 text-sm text-panvas-text-secondary"><span className="block">{label}</span>{detail && <span className="block text-xs text-panvas-text-tertiary">{detail}</span>}</span>{shortcut && <span className="text-xs text-panvas-text-tertiary">{shortcut}</span>}<span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${checked ? 'bg-panvas-accent-blue' : 'bg-panvas-bg-active'}`} aria-hidden="true"><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} /></span></button>;
}
