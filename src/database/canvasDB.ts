// ============================================
// Panvas — Canvas DB Operations
// ============================================

import { db } from './schema';
import type { CanvasData, CustomBlock, PdfFileData, ImageFileData } from '@/types/canvas';
import { generateId } from '@/lib/utils/id';

// ---- Canvas Data ----

export async function getCanvasData(userId: string | null, canvasFileId: string): Promise<CanvasData | undefined> {
  const data = await db.canvasData.get(canvasFileId);
  return data?.userId === userId ? data : undefined;
}

export async function saveCanvasData(userId: string | null, data: Partial<CanvasData> & { canvasFileId: string }): Promise<void> {
  const existing = await db.canvasData.get(data.canvasFileId);
  if (existing && existing.userId === userId) {
    await db.canvasData.update(data.canvasFileId, {
      ...data,
      version: (existing.version || 0) + 1,
      updatedAt: Date.now(),
    });
  } else {
    await db.canvasData.add({
      canvasFileId: data.canvasFileId,
      elements: data.elements || [],
      appState: data.appState || {},
      files: data.files || {},
      customBlocks: data.customBlocks || [],
      version: 1,
      updatedAt: Date.now(),
      userId: userId,
    });
  }
  // Also update the canvas file's updatedAt and mark for sync
  await db.canvasFiles.update(data.canvasFileId, {
    updatedAt: Date.now(),
    syncStatus: 'pending',
  });
}

// ---- Custom Blocks ----

export async function addCustomBlock(userId: string | null, block: Omit<CustomBlock, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<CustomBlock> {
  const now = Date.now();
  const newBlock: CustomBlock = {
    ...block,
    id: generateId('block'),
    createdAt: now,
    updatedAt: now,
    userId: userId,
  };
  await db.customBlocks.add(newBlock);
  return newBlock;
}

export async function updateCustomBlock(id: string, updates: Partial<CustomBlock>): Promise<void> {
  await db.customBlocks.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function deleteCustomBlock(id: string): Promise<void> {
  await db.customBlocks.delete(id);
}

export async function getBlocksByCanvas(userId: string | null, canvasFileId: string): Promise<CustomBlock[]> {
  return db.customBlocks
    .where('canvasFileId').equals(canvasFileId)
    .filter(cb => cb.userId === userId)
    .toArray();
}

/**
 * Restores complete custom blocks from a canonical Canvas JSON payload
 * (Electron filesystem parity / backup restore). Preserves original ids and
 * timestamps; only fills gaps — existing Dexie rows for the canvas are never
 * overwritten.
 */
export async function importCustomBlocks(userId: string | null, blocks: readonly CustomBlock[]): Promise<number> {
  if (blocks.length === 0) return 0;
  const stamped = blocks.map(block => ({ ...block, userId: block.userId ?? userId ?? '' }));
  await db.customBlocks.bulkPut(stamped);
  return stamped.length;
}

// ---- PDF Files ----

export async function storePdfFile(userId: string | null, canvasFileId: string, fileName: string, data: ArrayBuffer): Promise<PdfFileData> {
  const pdfFile: PdfFileData = {
    id: generateId('pdf'),
    canvasFileId,
    fileName,
    data,
    createdAt: Date.now(),
    userId: userId ?? '',
  };
  await db.pdfFiles.put(pdfFile);
  return pdfFile;
}

export async function getPdfFile(userId: string | null, id: string): Promise<PdfFileData | undefined> {
  const pdf = await db.pdfFiles.get(id);
  if (!pdf) return undefined;
  if (userId && pdf.userId && pdf.userId !== '' && pdf.userId !== userId) {
    return undefined;
  }
  return pdf;
}

export async function deletePdfFile(id: string): Promise<void> {
  await db.pdfFiles.delete(id);
}

// ---- Image Files ----

export async function storeImageFile(userId: string | null, canvasFileId: string, fileName: string, mimeType: string, data: ArrayBuffer): Promise<ImageFileData> {
  const imageFile: ImageFileData = {
    id: generateId('img'),
    canvasFileId,
    fileName,
    mimeType,
    data,
    createdAt: Date.now(),
    userId: userId ?? '',
  };
  await db.imageFiles.put(imageFile);
  return imageFile;
}

export async function getImageFile(id: string): Promise<ImageFileData | undefined> {
  return db.imageFiles.get(id);
}

export async function deleteImageFile(id: string): Promise<void> {
  await db.imageFiles.delete(id);
}
