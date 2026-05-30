import { z } from 'zod';

export const canvasSceneSchema = z.object({
  elements: z.array(z.unknown()).default([]),
  appState: z.record(z.string(), z.unknown()).default({}),
  files: z.record(z.string(), z.unknown()).default({}),
  customBlocks: z.array(z.unknown()).default([]),
});

export type CanvasScenePayload = z.infer<typeof canvasSceneSchema>;
