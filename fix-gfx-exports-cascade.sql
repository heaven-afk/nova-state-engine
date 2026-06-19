-- ============================================================
-- FIX: gfx_exports session_id foreign key cascade delete
-- Run this in Supabase SQL Editor to allow session deletion
-- ============================================================

-- Check and drop the existing foreign key constraint if it exists, then recreate it with ON DELETE CASCADE.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'gfx_exports' 
          AND kcu.column_name = 'session_id'
    ) THEN
        -- Find the constraint name (usually gfx_exports_session_id_fkey) and drop it
        ALTER TABLE public.gfx_exports DROP CONSTRAINT IF EXISTS gfx_exports_session_id_fkey;
    END IF;
END
$$;

-- Add constraint with ON DELETE CASCADE
ALTER TABLE public.gfx_exports
ADD CONSTRAINT gfx_exports_session_id_fkey
FOREIGN KEY (session_id)
REFERENCES public.scrims_sessions(id)
ON DELETE CASCADE;
