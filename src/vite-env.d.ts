/// <reference types="vite/client" />

interface Navigator {
  createHandwritingRecognizer?: (constraint: { languages: string[] }) => Promise<{
    startDrawing(hints?: { recognitionType?: string; alternatives?: number }): {
      addStroke(stroke: { addPoint(point: { x: number; y: number; t: number }): void }): void;
      getPrediction(): Promise<Array<{ text: string }>>;
    };
    finish(): void;
  }>;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_MARKETING_ONLY?: string;
  readonly VITE_ENABLE_CLOUD_SYNC?: string;
  readonly VITE_PANVAS_SYNC_V2?: string;
  readonly VITE_ENABLE_ANALYTICS?: string;
  readonly VITE_PANVAS_GOOGLE_WEB_CLIENT_ID?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
