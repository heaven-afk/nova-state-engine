-- ============================================================
-- FIX: user_roles RLS recursion causing 500 errors
-- Run this ENTIRE script in Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste → Run)
-- ============================================================

-- Step 1: DISABLE RLS temporarily to stop all policy evaluation
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on user_roles (regardless of name)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END
$$;

-- Step 3: Drop old helper functions if they exist
DROP FUNCTION IF EXISTS public.is_owner();
DROP FUNCTION IF EXISTS public.is_staff();

-- Step 4: Create SECURITY DEFINER functions (bypass RLS)
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
  );
$$;

-- Step 5: Re-enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 6: Create clean policies using the SECURITY DEFINER functions
-- (these functions bypass RLS internally, so no recursion)

-- Any authenticated user can read their own role
CREATE POLICY "read_own_role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Owner can read all roles
CREATE POLICY "owner_read_all" ON public.user_roles
  FOR SELECT USING (public.is_owner());

-- Owner can insert roles (or bootstrap first owner)
CREATE POLICY "owner_insert" ON public.user_roles
  FOR INSERT WITH CHECK (
    public.is_owner()
    OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner')
  );

-- Owner can update roles
CREATE POLICY "owner_update" ON public.user_roles
  FOR UPDATE USING (public.is_owner());

-- Owner can delete roles
CREATE POLICY "owner_delete" ON public.user_roles
  FOR DELETE USING (public.is_owner());

-- Step 7: Verify — list all policies now on user_roles
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public';
