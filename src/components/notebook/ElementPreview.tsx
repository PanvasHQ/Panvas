import React, { useEffect, useRef } from 'react';
import type { ElementSnapshot } from '@/services/elements/LocalElementRepository';
import { canvasRepository } from '@/repositories/CanvasRepository';
import type { NotebookEngine } from './engine/NotebookEngine';
import { getImageCrop } from './engine/imageAppearance';
import { getStrokeRenderHalfWidth } from './engine/strokeGeometry';
import { getStickyNoteColor, getStickyNoteOpacity, getStickyNoteShape, getStickyPaper, isStickyNote } from './stickyNotes';

function plainText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: string; content?: unknown[] };
  return node.text ?? node.content?.map(plainText).join(' ') ?? '';
}
export function ElementPreview({ snapshot, engine }: { snapshot: ElementSnapshot; engine: NotebookEngine }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let disposed = false;
    const bounds = [
      ...snapshot.strokes.flatMap(stroke => { const r = getStrokeRenderHalfWidth(stroke); return stroke.points.map(p => ({ x: p.x - r, y: p.y - r, width: r * 2, height: r * 2 })); }),
      ...[...snapshot.shapes, ...snapshot.texts, ...snapshot.images].map(object => {
        const height = object.height ?? 100, angle = (object.rotation ?? 0) * Math.PI / 180;
        const w = Math.abs(object.width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
        const h = Math.abs(object.width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
        return { x: object.x + object.width / 2 - w / 2, y: object.y + height / 2 - h / 2, width: w, height: h };
      }),
    ];
    if (!bounds.length) return;
    const left = Math.min(...bounds.map(b => b.x)), top = Math.min(...bounds.map(b => b.y));
    const width = Math.max(1, Math.max(...bounds.map(b => b.x + b.width)) - left), height = Math.max(1, Math.max(...bounds.map(b => b.y + b.height)) - top);
    const scale = Math.min(136 / width, 96 / height);
    const images = new Map<string, HTMLImageElement>();
    const draw = () => {
      if (disposed) return;
      ctx.resetTransform(); ctx.clearRect(0, 0, 144, 104);
      ctx.translate((144 - width * scale) / 2, (104 - height * scale) / 2); ctx.scale(scale, scale); ctx.translate(-left, -top);
      for (const object of snapshot.images) {
        const image = images.get(object.fileId); if (!image) continue;
        const crop = getImageCrop(object);
        ctx.save(); ctx.globalAlpha = object.opacity ?? 1; ctx.translate(object.x + object.width / 2, object.y + object.height / 2); ctx.rotate((object.rotation || 0) * Math.PI / 180);
        ctx.drawImage(image, crop.x * image.naturalWidth, crop.y * image.naturalHeight, crop.width * image.naturalWidth, crop.height * image.naturalHeight, -object.width / 2, -object.height / 2, object.width, object.height); ctx.restore();
      }
      snapshot.strokes.forEach(stroke => engine.drawing.renderStroke(ctx, stroke));
      snapshot.shapes.forEach(shape => engine.shapes.renderShape(ctx, shape));
      for (const object of snapshot.texts) {
        const height = object.height ?? 100;
        ctx.save(); ctx.translate(object.x + object.width / 2, object.y + height / 2); ctx.rotate((object.rotation || 0) * Math.PI / 180); ctx.translate(-object.width / 2, -height / 2);
        if (isStickyNote(object)) {
          ctx.globalAlpha = getStickyNoteOpacity(object); ctx.fillStyle = getStickyNoteColor(object); ctx.beginPath();
          const shape = getStickyNoteShape(object);
          if (shape === 'circle' || shape === 'oval') ctx.ellipse(object.width / 2, height / 2, object.width / 2, height / 2, 0, 0, Math.PI * 2);
          else if (shape === 'star') for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.22 : 0.5, angle = i * Math.PI / 5 - Math.PI / 2; const x = object.width * (0.5 + r * Math.cos(angle)), y = height * (0.5 + r * Math.sin(angle)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
          else ctx.roundRect(0, 0, object.width, height, shape === 'rounded-rect' ? 12 : 0);
          ctx.closePath(); ctx.fill(); ctx.clip(); ctx.strokeStyle = '#5b647033'; ctx.lineWidth = 1;
          const paper = getStickyPaper(object); ctx.beginPath();
          if (paper !== 'plain') for (let y = 24; y < height; y += 24) { ctx.moveTo(0, y); ctx.lineTo(object.width, y); }
          if (paper === 'grid') for (let x = 24; x < object.width; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
          ctx.stroke();
        } else if (object.metadata?.elementBackground) { ctx.fillStyle = String(object.metadata.elementBackground); ctx.fillRect(0, 0, object.width, height); }
        ctx.globalAlpha = 1; ctx.fillStyle = '#353535'; ctx.font = '14px sans-serif'; ctx.fillText(plainText(object.content).slice(0, 70), 12, 28, Math.max(1, object.width - 24)); ctx.restore();
      }
    };
    draw();
    for (const fileId of new Set(snapshot.images.map(image => image.fileId))) void (async () => {
      const asset = await canvasRepository.getImage(fileId); if (!asset || disposed) return;
      const url = URL.createObjectURL(new Blob([asset.data], { type: asset.mimeType }));
      try { const image = new Image(); image.src = url; await image.decode(); if (!disposed) { images.set(fileId, image); draw(); } } finally { URL.revokeObjectURL(url); }
    })().catch(() => {});
    return () => { disposed = true; images.clear(); };
  }, [snapshot, engine]);
  return <canvas ref={ref} width={144} height={104} className="h-full w-full" aria-hidden="true" />;
}
