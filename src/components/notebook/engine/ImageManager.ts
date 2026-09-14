import { ImageObject, DEFAULT_PAGE_LAYER_ID } from './drawingTypes.ts';
import { ViewportManager } from './ViewportManager.ts';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { LayerManager } from './LayerManager.ts';
import { getImageRenderAppearance, getImageCrop } from './imageAppearance.ts';

export class ImageManager {
  private images: ImageObject[] = [];
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private objectUrls: Map<string, string> = new Map();
  private viewport: ViewportManager;
  private redrawCallback?: () => void;
  private layerManager: LayerManager;

  constructor(viewport: ViewportManager, layerManager: LayerManager = new LayerManager()) {
    this.viewport = viewport;
    this.layerManager = layerManager;
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
    image.layerId ??= this.layerManager.getActiveLayerId();
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

  cacheImage(fileId: string, img: HTMLImageElement, objectUrl?: string): void {
    this.imageCache.set(fileId, img);
    if (objectUrl) {
      this.objectUrls.set(fileId, objectUrl);
    }
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

  renderImages(ctx: CanvasRenderingContext2D, layerId?: string): void {
    for (const imgObj of this.images) {
      if (layerId && imgObj.layerId !== layerId) continue;
      const imgLayerId = imgObj.layerId ?? DEFAULT_PAGE_LAYER_ID;
      if (layerId && imgLayerId !== layerId) continue;
      const imgElem = this.imageCache.get(imgObj.fileId);
      if (!imgElem) continue;

      ctx.save();
      // Ensure high quality bicubic/lanczos filtering across any zoom and display dimensions
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const appearance = getImageRenderAppearance(imgObj);
      ctx.globalAlpha *= appearance.opacity;

      // Move to center of image to apply rotation
      ctx.translate(imgObj.x + imgObj.width / 2, imgObj.y + imgObj.height / 2);
      ctx.rotate(appearance.rotationRadians);
      
      // Draw image centered at the translated coordinate using original full-resolution source
      const crop = getImageCrop(imgObj);
      ctx.drawImage(
        imgElem,
        crop.x * imgElem.naturalWidth, crop.y * imgElem.naturalHeight, crop.width * imgElem.naturalWidth, crop.height * imgElem.naturalHeight,
        -imgObj.width / 2,
        -imgObj.height / 2,
        imgObj.width,
        imgObj.height
      );
      
      ctx.restore();
    }
  }

  isEditable(image: ImageObject): boolean {
    return this.layerManager.isEditable(image.layerId);
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
