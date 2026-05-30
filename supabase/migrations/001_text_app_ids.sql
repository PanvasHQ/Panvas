-- Panvas migration: app-generated IDs are text values such as ws-... and canvas-...
-- Run this only if you previously created the tables with UUID app IDs.

ALTER TABLE IF EXISTS public.canvas_data
  DROP CONSTRAINT IF EXISTS canvas_data_canvas_file_id_fkey;

ALTER TABLE IF EXISTS public.canvas_files
  DROP CONSTRAINT IF EXISTS canvas_files_workspace_id_fkey,
  DROP CONSTRAINT IF EXISTS canvas_files_folder_id_fkey;

ALTER TABLE IF EXISTS public.folders
  DROP CONSTRAINT IF EXISTS folders_workspace_id_fkey,
  DROP CONSTRAINT IF EXISTS folders_parent_id_fkey;

ALTER TABLE IF EXISTS public.workspaces
  ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE IF EXISTS public.folders
  ALTER COLUMN id TYPE TEXT USING id::text,
  ALTER COLUMN workspace_id TYPE TEXT USING workspace_id::text,
  ALTER COLUMN parent_id TYPE TEXT USING parent_id::text;

ALTER TABLE IF EXISTS public.canvas_files
  ALTER COLUMN id TYPE TEXT USING id::text,
  ALTER COLUMN workspace_id TYPE TEXT USING workspace_id::text,
  ALTER COLUMN folder_id TYPE TEXT USING folder_id::text;

ALTER TABLE IF EXISTS public.canvas_data
  ALTER COLUMN canvas_file_id TYPE TEXT USING canvas_file_id::text;

ALTER TABLE IF EXISTS public.folders
  ADD CONSTRAINT folders_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD CONSTRAINT folders_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.folders(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.canvas_files
  ADD CONSTRAINT canvas_files_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD CONSTRAINT canvas_files_folder_id_fkey
    FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.canvas_data
  ADD CONSTRAINT canvas_data_canvas_file_id_fkey
    FOREIGN KEY (canvas_file_id) REFERENCES public.canvas_files(id) ON DELETE CASCADE;
