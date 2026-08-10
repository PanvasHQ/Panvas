import React from 'react';

export type DropType = 'IMAGE' | 'PDF' | 'UNSUPPORTED' | 'UNKNOWN';

export interface DropClassification {
  type: DropType;
  file: File | null;
}

export interface DropHandlers {
  onImageDrop?: (file: File, e: React.DragEvent) => void | Promise<void>;
  onPdfDrop?: (file: File, e: React.DragEvent) => void | Promise<void>;
  onUnsupportedDrop?: (file: File | null, e: React.DragEvent) => void | Promise<void>;
}

export class UniversalDropRouter {
  /**
   * Classifies the dataTransfer object to determine if it contains an image or PDF.
   */
  static classifyDrop(dataTransfer: DataTransfer | null): DropClassification {
    if (!dataTransfer || !dataTransfer.files || dataTransfer.files.length === 0) {
      return { type: 'UNKNOWN', file: null };
    }

    const file = dataTransfer.files[0];
    
    // Check for PDF
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      return { type: 'PDF', file };
    }
    
    // Check for Image
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)$/i.test(file.name)) {
      return { type: 'IMAGE', file };
    }

    return { type: 'UNSUPPORTED', file };
  }

  /**
   * A unified handler for React onDrop events.
   * It prevents default browser behaviors, classifies the drop, and routes it to the specific handler.
   */
  static async handleExternalDrop(e: React.DragEvent, handlers: DropHandlers) {
    e.preventDefault();
    e.stopPropagation();

    const classification = this.classifyDrop(e.dataTransfer);

    if (classification.type === 'IMAGE' && classification.file) {
      if (handlers.onImageDrop) {
        await handlers.onImageDrop(classification.file, e);
      }
    } else if (classification.type === 'PDF' && classification.file) {
      if (handlers.onPdfDrop) {
        await handlers.onPdfDrop(classification.file, e);
      }
    } else {
      if (handlers.onUnsupportedDrop) {
        await handlers.onUnsupportedDrop(classification.file, e);
      }
    }
  }

  /**
   * A unified handler for React onDragOver/onDragEnter events.
   * It prevents default behavior and sets the dropEffect to indicate whether the drop is accepted.
   */
  static handleDragOver(e: React.DragEvent, acceptedTypes: DropType[] = ['IMAGE', 'PDF']) {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer) {
      // NOTE: During dragOver, browsers often obscure e.dataTransfer.files for security reasons.
      // However, we can inspect e.dataTransfer.items.
      
      let isSupported = false;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];
          if (item.kind === 'file') {
            if (acceptedTypes.includes('IMAGE') && item.type.startsWith('image/')) {
              isSupported = true;
              break;
            }
            if (acceptedTypes.includes('PDF') && item.type === 'application/pdf') {
              isSupported = true;
              break;
            }
            // For file extensions (when type is empty), we have to be optimistic during dragOver
            if (!item.type && (acceptedTypes.includes('IMAGE') || acceptedTypes.includes('PDF'))) {
               isSupported = true;
               break;
            }
          }
        }
      } else {
        // If items are not available but acceptedTypes is specified, we optimistically accept 
        // to let the drop event fire, which can then be properly validated.
        isSupported = true; 
      }

      e.dataTransfer.dropEffect = isSupported ? 'copy' : 'none';
    }
  }
}
