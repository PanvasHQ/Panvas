export interface CanvasBackgroundPreset {
  label: string;
  color: string;
}

/** Stable, portable canvas background choices used by the Panvas toolbar. */
export const CANVAS_BACKGROUND_PRESETS: readonly CanvasBackgroundPreset[] = [
  { label: 'Warm Paper', color: '#f7f1e3' },
  { label: 'White', color: '#ffffff' },
  { label: 'Soft Gray', color: '#f1f3f5' },
  { label: 'Soft Blue', color: '#e7f0ff' },
  { label: 'Subtle Green', color: '#e8f5ec' },
  { label: 'Charcoal', color: '#242424' },
  { label: 'Black', color: '#000000' },
  { label: 'Transparent', color: 'transparent' },
];

/** Accept CSS hex colors and the explicit transparent canvas value. */
export function normalizeCanvasColor(value: string): string | null {
  const color = value.trim();
  if (color.toLowerCase() === 'transparent') return 'transparent';
  if (/^#[\da-f]{3,4}$/i.test(color) || /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(color)) {
    return color.toLowerCase();
  }
  return null;
}

/** Convert a validated value to the six-digit form accepted by `<input type="color">`. */
export function toColorInputValue(value: string): string {
  const normalized = normalizeCanvasColor(value);
  if (!normalized || normalized === 'transparent') return '#ffffff';
  const hex = normalized.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    return `#${hex.slice(0, 3).split('').map((digit) => `${digit}${digit}`).join('')}`;
  }
  return `#${hex.slice(0, 6)}`;
}
