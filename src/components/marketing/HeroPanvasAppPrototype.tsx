import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Undo2,
  RotateCcw,
  Trash2,
  Search,
  CloudOff,
  Moon,
  PanelLeftClose,
  Folder,
  BookOpen,
  FileText,
  Plus,
  Home,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Eye,
  Edit3,
  Presentation,
  Check,
  ArrowRight,
  Download,
  X,
} from 'lucide-react';

type Tool = 'pen' | 'pencil' | 'highlighter' | 'eraser';

interface StrokePoint {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  tool: Tool;
  color: string;
  thickness: number;
  points: StrokePoint[];
}

const PALETTE = [
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Charcoal', value: '#18181b' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Pink', value: '#ec4899' },
];

/**
 * Authentic SVG Cursors straight from Panvas NotebookPageView.tsx
 */
const svgCursor = (svg: string, hotspotX: number, hotspotY: number, fallback = 'crosshair') =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, ${fallback}`;

const ERASER_CURSOR = svgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="m7 20 10-10a3 3 0 0 1 4.2 0l4.8 4.8a3 3 0 0 1 0 4.2l-8 8H9l-4-4 2-7Z" fill="#f6c7d7" stroke="#5d4650" stroke-width="1.7" stroke-linejoin="round"/><path d="m11 24 5-5" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`,
  9,
  25,
  'cell'
);

function dynamicInkCursor(tool: Tool, color: string): string {
  if (tool === 'eraser') return ERASER_CURSOR;
  const ink = /^#[0-9a-f]{6}$/i.test(color) ? color : '#2563eb';
  const tip = tool === 'highlighter' ? '#fef08a' : ink;
  const body = tool === 'pencil' ? '#fbfaf7' : tip;
  const accent = tool === 'highlighter' ? ink : '#24201a';
  return svgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34"><path d="m7 26 3.5-8L24 4.5l5.5 5.5L16 23.5 7 26Z" fill="${body}" stroke="${accent}" stroke-width="1.8" stroke-linejoin="round"/><path d="m21.5 7 5.5 5.5" fill="none" stroke="${ink}" stroke-width="2"/><path d="m7 26 6.2-2.2-4-4L7 26Z" fill="${ink}" stroke="#24201a" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
    7,
    26,
    'crosshair'
  );
}

function setupContextForTool(
  ctx: CanvasRenderingContext2D,
  tool: Tool,
  color: string,
  thickness: number
) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = thickness * 5;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else if (tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = thickness * 3;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
  } else if (tool === 'pencil') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
  }
}

export function HeroPanvasAppPrototype({ onOpenWorkspace }: { onOpenWorkspace?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const welcomeImgRef = useRef<HTMLImageElement | null>(null);

  // Active stationary tool state
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#8b5cf6');
  const [thickness, setThickness] = useState(3.5);

  // Strokes state
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);

  // Try Panvas prompt modal
  const [showTryModal, setShowTryModal] = useState(false);

  // Direct synchronous drawing tracking (ZERO input latency)
  const isDrawing = useRef(false);
  const currentPoints = useRef<StrokePoint[]>([]);
  const lastPoint = useRef<StrokePoint | null>(null);

  // Preload authentic welcome handwriting
  useEffect(() => {
    const img = new Image();
    img.src = '/Application SS updated/HeroWelcomeInk.png';
    img.onload = () => {
      welcomeImgRef.current = img;
      redrawCanvas(strokes, showWelcome);
    };
  }, []);

  // Full canvas redraw
  const redrawCanvas = useCallback((strokeList: Stroke[], withWelcome: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Draw authentic welcome handwriting if active
    if (withWelcome && welcomeImgRef.current && welcomeImgRef.current.complete) {
      ctx.drawImage(welcomeImgRef.current, 0, 0, w, h);
    }

    // Draw user strokes
    for (const s of strokeList) {
      const pts = s.points;
      if (pts.length === 0) continue;

      ctx.save();
      setupContextForTool(ctx, s.tool, s.color, s.thickness);

      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, (s.tool === 'eraser' ? s.thickness * 5 : s.thickness) / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          const p1 = pts[i - 1];
          const p2 = pts[i];
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }, []);

  // Sync canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      redrawCanvas(strokes, showWelcome);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [strokes, showWelcome, redrawCanvas]);

  // Clamped coordinates to guarantee strokes never jump or glitch outside paper
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    return {
      x: Math.max(0, Math.min(rect.width, rawX)),
      y: Math.max(0, Math.min(rect.height, rawY)),
    };
  };

  /**
   * ZERO-LATENCY SYNCHRONOUS DRAWING:
   * Draw immediately on each mouse/stylus event without buffering in requestAnimationFrame
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    const pt = getCanvasPoint(e);
    lastPoint.current = pt;
    currentPoints.current = [pt];

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setupContextForTool(ctx, tool, color, thickness);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, (tool === 'eraser' ? thickness * 5 : thickness) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !lastPoint.current) return;
    const pt = getCanvasPoint(e);
    const prev = lastPoint.current;
    currentPoints.current.push(pt);
    lastPoint.current = pt;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setupContextForTool(ctx, tool, color, thickness);

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.restore();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (currentPoints.current.length > 0) {
      const newStroke: Stroke = {
        id: 's-' + Date.now(),
        tool,
        color,
        thickness,
        points: [...currentPoints.current],
      };
      setStrokes(prev => {
        const next = [...prev, newStroke];
        redrawCanvas(next, showWelcome);
        return next;
      });
    }
    currentPoints.current = [];
    lastPoint.current = null;
  };

  const handleUndo = () => {
    setStrokes(prev => {
      const next = prev.slice(0, -1);
      redrawCanvas(next, showWelcome);
      return next;
    });
  };

  const handleReset = () => {
    setShowWelcome(true);
    setStrokes([]);
    redrawCanvas([], true);
  };

  const handleClear = () => {
    setShowWelcome(false);
    setStrokes([]);
    redrawCanvas([], false);
  };

  const handleChromeClick = () => {
    setShowTryModal(true);
  };

  const handleOpenBrowser = () => {
    setShowTryModal(false);
    if (onOpenWorkspace) {
      onOpenWorkspace();
    } else {
      window.location.hash = '#/';
    }
  };

  const handleGoDownload = () => {
    setShowTryModal(false);
    const el = document.querySelector('#download');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.hash = '#download';
    }
  };

  return (
    <div className="panvas-hero-app-window" ref={containerRef}>
      {/* 1. Authentic Panvas Window Header - Clicking triggers Try Panvas */}
      <header
        className="panvas-app-topbar panvas-app-interactive-guard"
        onClick={handleChromeClick}
        title="Click to try full Panvas app"
      >
        <div className="panvas-app-topbar-left">
          <button type="button" className="panvas-app-icon-btn" title="Toggle sidebar">
            <PanelLeftClose size={13} />
          </button>
          <div className="panvas-app-logo">
            <span className="panvas-app-logo-mark">P</span>
            <span className="panvas-app-logo-text">Panvas</span>
          </div>
          <div className="panvas-app-breadcrumbs">
            <ChevronRight size={11} className="text-panvas-text-tertiary" />
            <span className="panvas-app-crumb">My Workspace</span>
            <ChevronRight size={11} className="text-panvas-text-tertiary" />
            <span className="panvas-app-crumb">NoteBook</span>
            <ChevronRight size={11} className="text-panvas-text-tertiary" />
            <span className="panvas-app-crumb">Topic1</span>
            <ChevronRight size={11} className="text-panvas-text-tertiary" />
            <span className="panvas-app-crumb active">page1</span>
          </div>
        </div>

        <div className="panvas-app-topbar-center">
          <div className="panvas-app-search-pill">
            <Search size={12} className="text-stone-400" />
            <span>Search Panvas</span>
            <kbd className="panvas-app-kbd">Ctrl K</kbd>
          </div>
        </div>

        <div className="panvas-app-topbar-right">
          <div className="panvas-app-sync-status">
            <CloudOff size={12} className="text-stone-400" />
            <span>Local only</span>
          </div>
          <button type="button" className="panvas-app-icon-btn" title="Toggle Theme">
            <Moon size={12} />
          </button>
          <div className="panvas-app-avatar" title="Active user">
            <span>U</span>
          </div>
        </div>
      </header>

      {/* 2. Main Work Area: Left Sidebar (Try Panvas), Center Canvas (WORKING), Right Sidebar (Try Panvas) */}
      <div className="panvas-app-body">
        {/* Left Sidebar - Clicking triggers Try Panvas */}
        <aside
          className="panvas-app-sidebar panvas-app-interactive-guard"
          onClick={handleChromeClick}
          title="Click to try full Panvas app"
        >
          <div className="panvas-app-sidebar-section">
            <div className="panvas-app-sidebar-heading">
              <span>LIBRARY</span>
              <span className="panvas-app-badge-local">Local</span>
            </div>
            <div className="panvas-app-new-btn">
              <Plus size={12} />
              <span>New item</span>
              <ChevronDown size={10} className="ml-auto" />
            </div>
            <div className="panvas-app-tree-row is-active">
              <Home size={13} />
              <span>Library</span>
            </div>
          </div>

          <div className="panvas-app-sidebar-section">
            <div className="panvas-app-sidebar-heading">
              <span>WORKSPACES</span>
              <Plus size={11} className="text-stone-500" />
            </div>
            <div className="panvas-app-tree-node">
              <div className="panvas-app-tree-row font-medium">
                <ChevronDown size={11} />
                <Folder size={12} className="text-amber-600" />
                <span>My Workspace</span>
              </div>
              <div className="panvas-app-tree-sub">
                <div className="panvas-app-tree-row is-active font-medium">
                  <ChevronDown size={10} />
                  <BookOpen size={11} className="text-purple-600" />
                  <span>NoteBook</span>
                  <span className="panvas-app-badge-count">1</span>
                </div>
                <div className="panvas-app-tree-leaf">
                  <div className="panvas-app-tree-row">
                    <ChevronDown size={9} />
                    <span>Topic1</span>
                    <span className="panvas-app-badge-count">1</span>
                  </div>
                  <div className="panvas-app-tree-page is-selected">
                    <FileText size={10} />
                    <span>page1</span>
                  </div>
                </div>
                <div className="panvas-app-tree-row text-stone-500">
                  <FileText size={11} />
                  <span>Welcome Canvas</span>
                </div>
                <div className="panvas-app-tree-row text-stone-500">
                  <Trash2 size={11} />
                  <span>Trash</span>
                  <span className="panvas-app-badge-count">0</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Workspace: THE WORKING SECTION (PAGE & TOP TOOLBAR) */}
        <main className="panvas-app-workspace">
          {/* Panvas Floating Toolbar - WORKING */}
          <div className="panvas-app-floating-toolbar-container">
            {/* Row 1: Tools */}
            <div className="panvas-app-toolbar-pill">
              <button
                type="button"
                className="panvas-app-tool-btn"
                onClick={handleUndo}
                title="Undo last stroke"
                disabled={strokes.length === 0}
              >
                <Undo2 size={12} />
              </button>
              <div className="panvas-app-toolbar-div" />
              <button
                type="button"
                className={'panvas-app-tool-btn' + (tool === 'pen' ? ' is-active' : '')}
                onClick={() => setTool('pen')}
                title="Pen tool"
              >
                <Pen size={13} />
              </button>
              <button
                type="button"
                className={'panvas-app-tool-btn' + (tool === 'pencil' ? ' is-active' : '')}
                onClick={() => setTool('pencil')}
                title="Pencil tool"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                className={'panvas-app-tool-btn' + (tool === 'highlighter' ? ' is-active' : '')}
                onClick={() => setTool('highlighter')}
                title="Highlighter tool"
              >
                <Highlighter size={13} />
              </button>
              <button
                type="button"
                className={'panvas-app-tool-btn' + (tool === 'eraser' ? ' is-active' : '')}
                onClick={() => setTool('eraser')}
                title="Eraser tool"
              >
                <Eraser size={13} />
              </button>
              <div className="panvas-app-toolbar-div" />
              <button
                type="button"
                className="panvas-app-tool-btn"
                onClick={handleReset}
                title="Restore Welcome handwriting"
              >
                <RotateCcw size={12} />
              </button>
              <button
                type="button"
                className="panvas-app-tool-btn"
                onClick={handleClear}
                title="Clear page"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Row 2: Colors & Thickness */}
            <div className="panvas-app-toolbar-subpill">
              <div className="panvas-app-palette">
                {PALETTE.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={
                      'panvas-app-color-dot' +
                      (color === c.value && tool !== 'eraser' ? ' is-active' : '')
                    }
                    style={{ backgroundColor: c.value }}
                    onClick={() => {
                      setColor(c.value);
                      if (tool === 'eraser') setTool('pen');
                    }}
                    title={c.label}
                  />
                ))}
              </div>
              <div className="panvas-app-toolbar-div" />
              <div className="panvas-app-size-picker">
                {[2, 3.5, 6].map(s => (
                  <button
                    key={s}
                    type="button"
                    className={'panvas-app-size-btn' + (thickness === s ? ' is-active' : '')}
                    onClick={() => setThickness(s)}
                    title={`${s}px`}
                  >
                    <span
                      style={{
                        width: s * 1.5,
                        height: s * 1.5,
                        borderRadius: '50%',
                        backgroundColor: 'currentColor',
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notebook Paper Sheet with Small Grid SVG Pattern - WORKING */}
          <div className="panvas-app-paper-sheet">
            <svg
              className="panvas-app-grid-bg"
              width="100%"
              height="100%"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="pat-proto-small-grid" width="14" height="14" patternUnits="userSpaceOnUse">
                  <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#e4ded5" strokeWidth="0.75" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#pat-proto-small-grid)" />
            </svg>

            {/* Live Interactive Canvas - 0ms Synchronous Draw */}
            <canvas
              ref={canvasRef}
              className="panvas-app-drawing-canvas"
              style={{ cursor: dynamicInkCursor(tool, color) }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>
        </main>

        {/* Right Properties Panel: PAGE & VIEW - Clicking triggers Try Panvas */}
        <aside
          className="panvas-app-properties panvas-app-interactive-guard"
          onClick={handleChromeClick}
          title="Click to try full Panvas app"
        >
          <div className="panvas-app-prop-header">
            <span>PAGE & VIEW</span>
          </div>

          <div className="panvas-app-prop-group">
            <label className="panvas-app-prop-label">DOCUMENT MODE</label>
            <div className="panvas-app-segmented-control">
              <div className="panvas-app-segment is-active">
                <Edit3 size={10} />
                <span>Edit</span>
              </div>
              <div className="panvas-app-segment">
                <Eye size={10} />
                <span>Read</span>
              </div>
              <div className="panvas-app-segment">
                <Presentation size={10} />
                <span>Present</span>
              </div>
            </div>
          </div>

          <div className="panvas-app-prop-group">
            <label className="panvas-app-prop-label">LAYOUT</label>
            <div className="panvas-app-select-mock">
              <span>Single pane</span>
              <ChevronDown size={10} />
            </div>
          </div>

          <div className="panvas-app-prop-group">
            <div className="flex justify-between items-center text-xs">
              <span className="panvas-app-prop-label mb-0">Zoom</span>
              <span className="text-stone-500 font-mono text-[10px]">100%</span>
            </div>
            <div className="panvas-app-zoom-controls">
              <button type="button">Out</button>
              <button type="button" className="is-active">100%</button>
              <button type="button">In</button>
            </div>
          </div>

          <div className="panvas-app-prop-group">
            <label className="panvas-app-prop-label">Paper Color</label>
            <div className="panvas-app-paper-swatches">
              {['#ffffff', '#F5F5F0', '#FFF9C4', '#E3F2FD', '#FCE4EC', '#232323'].map((sc, i) => (
                <div
                  key={sc}
                  className={'panvas-app-swatch' + (i === 0 ? ' is-active' : '')}
                  style={{ backgroundColor: sc }}
                >
                  {i === 0 && <Check size={8} className="text-stone-700" />}
                </div>
              ))}
            </div>
          </div>

          <div className="panvas-app-prop-group">
            <label className="panvas-app-prop-label">Background Format</label>
            <div className="panvas-app-select-mock">
              <span>Small Grid</span>
              <ChevronDown size={10} />
            </div>
          </div>

          <div className="panvas-app-prop-group">
            <label className="panvas-app-prop-label">Orientation</label>
            <div className="panvas-app-segmented-control">
              <div className="panvas-app-segment is-active">Portrait</div>
              <div className="panvas-app-segment">Landscape</div>
            </div>
          </div>

          <div className="panvas-app-prop-group">
            <label className="panvas-app-prop-label">Page Size</label>
            <div className="panvas-app-select-mock">
              <span>A4</span>
              <ChevronDown size={10} />
            </div>
          </div>

          <div className="panvas-app-prop-group">
            <label className="panvas-app-prop-label">Margins</label>
            <div className="panvas-app-select-mock">
              <span>No Margin</span>
              <ChevronDown size={10} />
            </div>
          </div>
        </aside>
      </div>

      {/* 3. Authentic Panvas Bottom Status Bar - Clicking triggers Try Panvas */}
      <footer
        className="panvas-app-statusbar panvas-app-interactive-guard"
        onClick={handleChromeClick}
        title="Click to try full Panvas app"
      >
        <div className="panvas-app-statusbar-left">
          <HardDrive size={11} className="text-stone-400" />
          <span>Local storage: Stored on this device</span>
        </div>
        <div className="panvas-app-statusbar-center">
          <span>Saved</span>
        </div>
        <div className="panvas-app-statusbar-right">
          <span className="panvas-app-status-dot" />
          <span>Online v0.1.0</span>
        </div>
      </footer>

      {/* 4. Non-Blocking Floating Action Dock */}
      {showTryModal && (
        <div className="panvas-app-dock-toast" role="status" aria-live="polite">
          <div className="panvas-app-dock-label">
            <span className="panvas-app-dock-dot" />
            <span>Interactive Demo</span>
          </div>
          <div className="panvas-app-dock-actions">
            <button
              type="button"
              className="panvas-app-dock-btn-primary"
              onClick={handleOpenBrowser}
              title="Open full Panvas app in your browser"
            >
              <span>Open in browser</span>
              <ArrowRight size={11} />
            </button>
            <button
              type="button"
              className="panvas-app-dock-btn-secondary"
              onClick={handleGoDownload}
              title="Download Panvas for Windows"
            >
              <Download size={11} />
              <span>Windows</span>
            </button>
            <button
              type="button"
              className="panvas-app-dock-close"
              onClick={(e) => {
                e.stopPropagation();
                setShowTryModal(false);
              }}
              aria-label="Dismiss notification"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
