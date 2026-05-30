-- ============================================
-- Panvas — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable Row Level Security on all tables
-- ============================================

-- Workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own workspaces" ON public.workspaces;
CREATE POLICY "Users can CRUD their own workspaces"
  ON public.workspaces
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Folders
CREATE TABLE IF NOT EXISTS public.folders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES public.folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_expanded BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own folders" ON public.folders;
CREATE POLICY "Users can CRUD their own folders"
  ON public.folders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Canvas Files
CREATE TABLE IF NOT EXISTS public.canvas_files (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES public.folders(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_opened_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.canvas_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own canvas files" ON public.canvas_files;
CREATE POLICY "Users can CRUD their own canvas files"
  ON public.canvas_files
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Canvas Data (stores scene JSON reference)
CREATE TABLE IF NOT EXISTS public.canvas_data (
  canvas_file_id TEXT PRIMARY KEY REFERENCES public.canvas_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scene_version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.canvas_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own canvas data" ON public.canvas_data;
CREATE POLICY "Users can CRUD their own canvas data"
  ON public.canvas_data
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_folders_workspace ON public.folders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_canvas_files_workspace ON public.canvas_files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_canvas_files_folder ON public.canvas_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_canvas_files_updated ON public.canvas_files(updated_at DESC);

-- Storage bucket for canvas scene data (JSON files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('canvas-scenes', 'canvas-scenes', false)
ON CONFLICT DO NOTHING;

-- Storage policy: users can only access their own files
DROP POLICY IF EXISTS "Users can manage their own scene files" ON storage.objects;
CREATE POLICY "Users can manage their own scene files"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'canvas-scenes' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'canvas-scenes' AND auth.uid()::text = (storage.foldername(name))[1]);
