import type { ImageObject } from './drawingTypes.ts';

export const FULL_IMAGE_CROP = Object.freeze({ x: 0, y: 0, width: 1, height: 1 });
export function getImageCrop(image: Pick<ImageObject, 'crop'>) {
  const crop = image.crop;
  return crop && [crop.x, crop.y, crop.width, crop.height].every(Number.isFinite)
    && crop.x >= 0 && crop.y >= 0 && crop.width > 0 && crop.height > 0
    && crop.x + crop.width <= 1.000001 && crop.y + crop.height <= 1.000001
    ? crop : FULL_IMAGE_CROP;
}

/** Keep the original source at the same scale/rotation when changing its window. */
export function recropImageGeometry(image: ImageObject, crop: NonNullable<ImageObject['crop']>) {
  const previous = getImageCrop(image);
  const sourceWidth = image.width / previous.width;
  const sourceHeight = image.height / previous.height;
  const dx = (crop.x + crop.width / 2 - previous.x - previous.width / 2) * sourceWidth;
  const dy = (crop.y + crop.height / 2 - previous.y - previous.height / 2) * sourceHeight;
  const angle = (image.rotation || 0) * Math.PI / 180;
  const width = sourceWidth * crop.width, height = sourceHeight * crop.height;
  return { width, height,
    x: image.x + image.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle) - width / 2,
    y: image.y + image.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) - height / 2 };
}

export function getImageRenderAppearance(image: Pick<ImageObject, 'opacity' | 'rotation'>): {
  opacity: number;
  rotationRadians: number;
} {
  return {
    opacity: Math.max(0, Math.min(1, image.opacity ?? 1)),
    rotationRadians: ((image.rotation || 0) * Math.PI) / 180,
  };
}
