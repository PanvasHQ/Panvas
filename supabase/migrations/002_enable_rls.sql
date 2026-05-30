-- Panvas migration: Enable Row Level Security (RLS) on all user data tables
-- This ensures strict isolation between accounts so users cannot read/write
-- other users' workspaces, folders, or canvases under any circumstance.

-- 1. Enable RLS on all tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_data ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for workspaces
CREATE POLICY "Users can view own workspaces" 
ON public.workspaces FOR SELECT 
USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can insert own workspaces" 
ON public.workspaces FOR INSERT 
WITH CHECK (auth.uid() = user_id::uuid);

CREATE POLICY "Users can update own workspaces" 
ON public.workspaces FOR UPDATE 
USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can delete own workspaces" 
ON public.workspaces FOR DELETE 
USING (auth.uid() = user_id::uuid);

-- 3. Create policies for folders
CREATE POLICY "Users can view own folders" 
ON public.folders FOR SELECT 
USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can insert own folders" 
ON public.folders FOR INSERT 
WITH CHECK (auth.uid() = user_id::uuid);

CREATE POLICY "Users can update own folders" 
ON public.folders FOR UPDATE 
USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can delete own folders" 
ON public.folders FOR DELETE 
USING (auth.uid() = user_id::uuid);

-- 4. Create policies for canvas_files
CREATE POLICY "Users can view own canvas_files" 
ON public.canvas_files FOR SELECT 
USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can insert own canvas_files" 
ON public.canvas_files FOR INSERT 
WITH CHECK (auth.uid() = user_id::uuid);

CREATE POLICY "Users can update own canvas_files" 
ON public.canvas_files FOR UPDATE 
USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can delete own canvas_files" 
ON public.canvas_files FOR DELETE 
USING (auth.uid() = user_id::uuid);

-- 5. Create policies for canvas_data
CREATE POLICY "Users can view own canvas_data" 
ON public.canvas_data FOR SELECT 
USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can insert own canvas_data" 
ON public.canvas_data FOR INSERT 
WITH CHECK (auth.uid() = user_id::uuid);

CREATE POLICY "Users can update own canvas_data" 
ON public.canvas_data FOR UPDATE 
USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can delete own canvas_data" 
ON public.canvas_data FOR DELETE 
USING (auth.uid() = user_id::uuid);
