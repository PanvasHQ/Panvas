import { NotebookEngine } from '../../src/components/notebook/engine/NotebookEngine';
import type { Stroke, DrawingData } from '../../src/components/notebook/engine/drawingTypes';

const engine = new NotebookEngine();
const canvas = document.querySelector<HTMLCanvasElement>('#paper')!;
engine.mount(canvas, 700, 650);
const setup = (angle: number, zoom: number, tool = 'marker', opacity = 1, thickness = 40, overlap = false) => {
  engine.setDrawingData(null, 'eraser-page');
  engine.viewport.setRenderTransform({ pan: true, scale: false });
  engine.viewport.setPan(17, 23);
  engine.viewport.setZoom(zoom);
  canvas.style.transform = `scale(${zoom})`;
  engine.tools.setRulerEnabled(true);
  engine.ruler.setCenter(330, 285);
  engine.ruler.setWidth(260);
  engine.ruler.setAngle(angle * Math.PI / 180, false);
  const toPage = (x: number, y: number) => ({ x: 330 + x * Math.cos(angle * Math.PI / 180) - y * Math.sin(angle * Math.PI / 180), y: 285 + x * Math.sin(angle * Math.PI / 180) + y * Math.cos(angle * Math.PI / 180) });
  const stroke: Stroke = { type: 'stroke', id: 'green', tool: tool as Stroke['tool'], color: '#179b36', opacity, thickness, createdAt: 1,
    points: [-170, -100, 0, 100, 170].map((x, i) => ({ ...toPage(x, 0), pressure: .75, t: i * 20 })) };
  engine.drawing.addStroke(stroke);
  if (overlap) engine.drawing.addStroke({ ...structuredClone(stroke), id: 'overlap', color: '#147adb', createdAt: 2, points: stroke.points.map(p => ({ ...p, x: p.x + 3, y: p.y + 2 })) });
  engine.tools.setMode('erase');
  engine.tools.setEraserMode('pixel');
  engine.tools.setThickness(100);
  engine.drawing.redraw();
};
const renderInk = () => {
  const output = document.createElement('canvas'); output.width = 700; output.height = 650;
  const ctx = output.getContext('2d')!;
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 700, 650);
  for (const stroke of engine.drawing.getStrokes()) engine.drawing.renderStroke(ctx, stroke);
  return output.toDataURL();
};
Object.assign(window, { engine, setup, renderInk, read: () => structuredClone(engine.getDrawingData()), reopen: (data: DrawingData) => engine.setDrawingData(data, 'eraser-page') });
const saved = localStorage.getItem('ruler-eraser-regression');
if (saved) engine.setDrawingData(JSON.parse(saved), 'eraser-page');
