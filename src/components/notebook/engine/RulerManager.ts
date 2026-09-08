import type { StrokePoint } from './drawingTypes.ts';
import type { InkRegion } from './inkRegion.ts';

export type RulerEdge = 'top' | 'bottom';
export type RulerHit = 'move' | 'rotate' | 'resize-start' | 'resize-end' | null;

export interface RulerLineSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface RulerState {
  enabled: boolean;
  center: { x: number; y: number };
  width: number;
  height: number;
  angle: number;
}

export interface RulerSnapResult {
  isSnapped: boolean;
  point: StrokePoint;
  edge: RulerEdge | null;
}

const ROTATION_HANDLE_OFFSET = 24;
const ROTATION_HANDLE_RADIUS = 12;
const CSS_PX_PER_MM = 96 / 25.4;
const MIN_RULER_MM = 50;
const RESIZE_HANDLE_WIDTH = 14;
const ANGLE_SNAP_TOLERANCE = 3 * Math.PI / 180;
const CANONICAL_ANGLES = [
  -Math.PI,
  -5 * Math.PI / 6,
  -3 * Math.PI / 4,
  -2 * Math.PI / 3,
  -Math.PI / 2,
  -Math.PI / 3,
  -Math.PI / 4,
  -Math.PI / 6,
  0,
  Math.PI / 6,
  Math.PI / 4,
  Math.PI / 3,
  Math.PI / 2,
  2 * Math.PI / 3,
  3 * Math.PI / 4,
  5 * Math.PI / 6,
  Math.PI,
] as const;

function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized <= -Math.PI) normalized += Math.PI * 2;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  return normalized;
}

function rotateLocalPoint(
  center: { x: number; y: number },
  angle: number,
  localX: number,
  localY: number,
): { x: number; y: number } {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: center.x + localX * cosine - localY * sine,
    y: center.y + localX * sine + localY * cosine,
  };
}

function projectToSegment(point: StrokePoint, segment: RulerLineSegment): { point: StrokePoint; distance: number } {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0
    ? 0
    : ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared;
  const clamped = Math.max(0, Math.min(1, projection));
  const x = segment.start.x + dx * clamped;
  const y = segment.start.y + dy * clamped;
  return {
    point: { ...point, x, y },
    distance: Math.hypot(point.x - x, point.y - y),
  };
}

export class RulerManager {
  private state: RulerState = {
    enabled: false,
    center: { x: 320, y: 180 },
    width: 150 * CSS_PX_PER_MM,
    height: 64,
    angle: 0,
  };

  getState(): Readonly<RulerState> {
    return {
      ...this.state,
      center: { ...this.state.center },
    };
  }

  setEnabled(enabled: boolean): boolean {
    if (this.state.enabled === enabled) return false;
    this.state.enabled = enabled;
    return true;
  }

  setCenter(x: number, y: number): void {
    this.state.center = { x, y };
  }

  private maxLength = 297 * CSS_PX_PER_MM;

  setMaxLength(length: number): void {
    this.maxLength = Math.max(MIN_RULER_MM * CSS_PX_PER_MM, length);
    this.state.width = Math.min(this.state.width, this.maxLength);
  }

  setWidth(width: number): void {
    this.state.width = Math.max(MIN_RULER_MM * CSS_PX_PER_MM, Math.min(this.maxLength, width));
  }

  setAngle(angle: number, snapToCanonicalAngles = true): number {
    const normalized = normalizeAngle(angle);
    let finalAngle = normalized;
    if (snapToCanonicalAngles) {
      let closest = normalized;
      let closestDistance = Infinity;
      for (const candidate of CANONICAL_ANGLES) {
        const distance = Math.abs(normalizeAngle(normalized - candidate));
        if (distance < closestDistance) {
          closest = candidate;
          closestDistance = distance;
        }
      }
      if (closestDistance <= ANGLE_SNAP_TOLERANCE) finalAngle = normalizeAngle(closest);
    }
    this.state.angle = finalAngle;
    return finalAngle;
  }

  getEdges(): { top: RulerLineSegment; bottom: RulerLineSegment } {
    const halfWidth = this.state.width / 2;
    const halfHeight = this.state.height / 2;
    return {
      top: {
        start: rotateLocalPoint(this.state.center, this.state.angle, -halfWidth, -halfHeight),
        end: rotateLocalPoint(this.state.center, this.state.angle, halfWidth, -halfHeight),
      },
      bottom: {
        start: rotateLocalPoint(this.state.center, this.state.angle, -halfWidth, halfHeight),
        end: rotateLocalPoint(this.state.center, this.state.angle, halfWidth, halfHeight),
      },
    };
  }

  /** Full body in the same page coordinates used by drawing and erasing. */
  getBodyPolygon(): InkRegion {
    if (!this.state.enabled) return [];
    const { center, angle, width, height } = this.state;
    const corners = [
      [-width / 2, -height / 2], [width / 2, -height / 2],
      [width / 2, height / 2], [-width / 2, height / 2],
    ].map(([x, y]): [number, number] => {
      const point = rotateLocalPoint(center, angle, x, y);
      return [point.x, point.y];
    });
    corners.push([...corners[0]]);
    return [[corners]];
  }

  getRotationHandle(): { x: number; y: number } {
    return rotateLocalPoint(
      this.state.center,
      this.state.angle,
      0,
      -this.state.height / 2 - ROTATION_HANDLE_OFFSET,
    );
  }

  snapPointToEdge(point: StrokePoint, threshold = 20): RulerSnapResult {
    if (!this.state.enabled) return { isSnapped: false, point, edge: null };

    const edges = this.getEdges();
    const top = projectToSegment(point, edges.top);
    const bottom = projectToSegment(point, edges.bottom);
    const nearest = top.distance <= bottom.distance
      ? { ...top, edge: 'top' as const }
      : { ...bottom, edge: 'bottom' as const };

    return nearest.distance <= threshold
      ? { isSnapped: true, point: nearest.point, edge: nearest.edge }
      : { isSnapped: false, point, edge: null };
  }

  hitTest(x: number, y: number): RulerHit {
    if (!this.state.enabled) return null;

    const handle = this.getRotationHandle();
    if (Math.hypot(x - handle.x, y - handle.y) <= ROTATION_HANDLE_RADIUS) return 'rotate';

    const dx = x - this.state.center.x;
    const dy = y - this.state.center.y;
    const cosine = Math.cos(this.state.angle);
    const sine = Math.sin(this.state.angle);
    const localX = dx * cosine + dy * sine;
    const localY = -dx * sine + dy * cosine;
    if (Math.abs(localY) > this.state.height / 2 || Math.abs(localX) > this.state.width / 2) return null;
    if (localX <= -this.state.width / 2 + RESIZE_HANDLE_WIDTH) return 'resize-start';
    if (localX >= this.state.width / 2 - RESIZE_HANDLE_WIDTH) return 'resize-end';
    return 'move';
  }

  intersectsCircle(x: number, y: number, radius: number): boolean {
    if (!this.state.enabled) return false;
    const dx = x - this.state.center.x;
    const dy = y - this.state.center.y;
    const cosine = Math.cos(this.state.angle);
    const sine = Math.sin(this.state.angle);
    const localX = dx * cosine + dy * sine;
    const localY = -dx * sine + dy * cosine;
    const nearestX = Math.max(-this.state.width / 2, Math.min(this.state.width / 2, localX));
    const nearestY = Math.max(-this.state.height / 2, Math.min(this.state.height / 2, localY));
    return Math.hypot(localX - nearestX, localY - nearestY) <= radius;
  }

  protectedSegmentInterval(start: StrokePoint, end: StrokePoint): [number, number] | null {
    if (!this.state.enabled) return null;
    const cosine = Math.cos(this.state.angle);
    const sine = Math.sin(this.state.angle);
    const toLocal = (point: StrokePoint) => {
      const dx = point.x - this.state.center.x;
      const dy = point.y - this.state.center.y;
      return { x: dx * cosine + dy * sine, y: -dx * sine + dy * cosine };
    };
    const localStart = toLocal(start);
    const localEnd = toLocal(end);
    const deltaX = localEnd.x - localStart.x;
    const deltaY = localEnd.y - localStart.y;
    let enter = 0;
    let exit = 1;
    const clip = (p: number, q: number): boolean => {
      if (Math.abs(p) < 1e-9) return q >= 0;
      const ratio = q / p;
      if (p < 0) enter = Math.max(enter, ratio);
      else exit = Math.min(exit, ratio);
      return enter <= exit;
    };
    const halfWidth = this.state.width / 2;
    const halfHeight = this.state.height / 2;
    if (!clip(-deltaX, localStart.x + halfWidth)) return null;
    if (!clip(deltaX, halfWidth - localStart.x)) return null;
    if (!clip(-deltaY, localStart.y + halfHeight)) return null;
    if (!clip(deltaY, halfHeight - localStart.y)) return null;
    return enter <= exit ? [enter, exit] : null;
  }


  render(ctx: CanvasRenderingContext2D, scale: number, darkMode: boolean): void {
    if (!this.state.enabled) return;

    const halfWidth = this.state.width / 2;
    const halfHeight = this.state.height / 2;
    const safeScale = Math.max(scale, 0.01);
    ctx.save();
    ctx.translate(this.state.center.x, this.state.center.y);
    ctx.rotate(this.state.angle);

    ctx.shadowColor = darkMode ? 'rgba(0, 0, 0, 0.55)' : 'rgba(15, 23, 42, 0.24)';
    ctx.shadowBlur = 14 / safeScale;
    ctx.shadowOffsetY = 4 / safeScale;
    ctx.fillStyle = darkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(240, 244, 248, 0.88)';
    ctx.strokeStyle = darkMode ? 'rgba(148, 163, 184, 0.75)' : 'rgba(71, 85, 105, 0.55)';
    ctx.lineWidth = 1 / safeScale;
    ctx.beginPath();
    ctx.roundRect(-halfWidth, -halfHeight, this.state.width, this.state.height, 8 / safeScale);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();

    ctx.strokeStyle = darkMode ? 'rgba(226, 232, 240, 0.78)' : 'rgba(51, 65, 85, 0.72)';
    ctx.fillStyle = darkMode ? '#e2e8f0' : '#334155';
    ctx.font = `${10 / safeScale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const rulerMillimetres = Math.floor(this.state.width / CSS_PX_PER_MM);
    for (let millimetres = 0; millimetres <= rulerMillimetres; millimetres += 1) {
      const x = -halfWidth + millimetres * CSS_PX_PER_MM;
      const major = millimetres % 10 === 0;
      const half = millimetres % 5 === 0;
      const tickLength = (major ? 14 : half ? 10 : 6) / safeScale;
      ctx.beginPath();
      ctx.moveTo(x, -halfHeight);
      ctx.lineTo(x, -halfHeight + tickLength);
      ctx.moveTo(x, halfHeight);
      ctx.lineTo(x, halfHeight - tickLength);
      ctx.stroke();
      if (major && millimetres > 0 && millimetres < rulerMillimetres) {
        ctx.fillText(String(millimetres / 10), x, -halfHeight + 16 / safeScale);
      }
    }

    ctx.font = `${8 / safeScale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('cm', -halfWidth + 5 / safeScale, -halfHeight + 16 / safeScale);

    ctx.fillStyle = darkMode ? 'rgba(226,232,240,.7)' : 'rgba(51,65,85,.6)';
    ctx.fillRect(-halfWidth, -halfHeight, RESIZE_HANDLE_WIDTH / safeScale, this.state.height);
    ctx.fillRect(halfWidth - RESIZE_HANDLE_WIDTH / safeScale, -halfHeight, RESIZE_HANDLE_WIDTH / safeScale, this.state.height);

    const degrees = ((this.state.angle * 180 / Math.PI) % 360 + 360) % 360;
    const angleLabel = `${degrees.toFixed(1)}°`;
    ctx.font = `600 ${11 / safeScale}px ui-sans-serif, system-ui, sans-serif`;
    const badgeWidth = 54 / safeScale;
    const badgeHeight = 22 / safeScale;
    ctx.fillStyle = darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, 7 / safeScale);
    ctx.fill();
    ctx.fillStyle = darkMode ? '#e2e8f0' : '#1e293b';
    ctx.textBaseline = 'middle';
    ctx.fillText(angleLabel, 0, 0);

    const handleY = -halfHeight - ROTATION_HANDLE_OFFSET;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / safeScale;
    ctx.beginPath();
    ctx.moveTo(0, -halfHeight);
    ctx.lineTo(0, handleY);
    ctx.stroke();
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(0, handleY, 7 / safeScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
