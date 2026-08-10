import { ImageObject } from './drawingTypes';
import { ViewportManager } from './ViewportManager';
import { canvasRepository } from '@/repositories/CanvasRepository';

export class ImageManager {
  private images: ImageObject[] = [];
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private objectUrls: Map<string, string> = new Map();
  private viewport: ViewportManager;
  private redrawCallback?: () => void;

  constructor(viewport: ViewportManager) {
    this.viewport = viewport;
  }

  setRedrawCallback(cb: () => void) {
    this.redrawCallback = cb;
  }

  getImages(): ImageObject[] {
    return this.images;
  }

  setImages(images: ImageObject[]): void {
    this.images = images;
    // Preload newly set images
    for (const img of images) {
      this.preloadImage(img.fileId);
    }
  }

  addImage(image: ImageObject): void {
    this.images.push(image);
    this.preloadImage(image.fileId);
  }

  removeImage(id: string): ImageObject | undefined {
    const index = this.images.findIndex(i => i.id === id);
    if (index === -1) return undefined;
    const [removed] = this.images.splice(index, 1);
    return removed;
  }

  removeImages(ids: Set<string>): ImageObject[] {
    const removed: ImageObject[] = [];
    this.images = this.images.filter(i => {
      if (ids.has(i.id)) {
        removed.push(i);
        return false;
      }
      return true;
    });
    return removed;
  }

  cacheImage(fileId: string, img: HTMLImageElement): void {
    this.imageCache.set(fileId, img);
  }

  clearImages(): ImageObject[] {
    const removed = [...this.images];
    this.images = [];
    return removed;
  }

  private async preloadImage(fileId: string) {
    if (this.imageCache.has(fileId)) {
      if (this.redrawCallback) this.redrawCallback();
      return;
    }

    try {
      const fileData = await canvasRepository.getImage(fileId);
      if (!fileData) return;

      const blob = new Blob([fileData.data], { type: fileData.mimeType });
      const url = URL.createObjectURL(blob);
      this.objectUrls.set(fileId, url);

      const img = new Image();
      img.onload = () => {
        this.imageCache.set(fileId, img);
        if (this.redrawCallback) this.redrawCallback();
      };
      img.src = url;
    } catch (err) {
      console.error('Failed to load image:', err);
    }
  }

  renderImages(ctx: CanvasRenderingContext2D): void {
    for (const imgObj of this.images) {
      const imgElem = this.imageCache.get(imgObj.fileId);
      if (!imgElem) continue;

      ctx.save();
      // Move to center of image to apply rotation
      ctx.translate(imgObj.x + imgObj.width / 2, imgObj.y + imgObj.height / 2);
      ctx.rotate(((imgObj.rotation || 0) * Math.PI) / 180);
      
      // Draw image centered at the translated coordinate
      ctx.drawImage(
        imgElem,
        -imgObj.width / 2,
        -imgObj.height / 2,
        imgObj.width,
        imgObj.height
      );
      
      ctx.restore();
    }
  }

  // Cleanup object URLs to prevent memory leaks when manager is destroyed
  destroy() {
    for (const url of this.objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
    this.imageCache.clear();
  }
}
