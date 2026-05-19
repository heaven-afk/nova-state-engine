-- ============================================================
-- FIX: user_roles RLS recursion causing 500 errors
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Step 1: Create a SECURITY DEFINER function that bypasses RLS
-- to check if the current user is an owner. This breaks the
-- infinite recursion where the owner_read_all policy queries
-- user_roles → triggers RLS → queries user_roles → ...

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

-- Step 2: Drop the old recursive policies
DROP POLICY IF EXISTS "read_own_role" ON user_roles;
DROP POLICY IF EXISTS "owner_read_all" ON user_roles;
DROP POLICY IF EXISTS "owner_insert" ON user_roles;
DROP POLICY IF EXISTS "owner_update" ON user_roles;
DROP POLICY IF EXISTS "owner_delete" ON user_roles;

-- Step 3: Recreate policies using the SECURITY DEFINER functions
-- (no more recursive subqueries on user_roles)

-- Any authenticated user can read their own role
CREATE POLICY "read_own_role" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Owner can read all roles
CREATE POLICY "owner_read_all" ON user_roles
  FOR SELECT USING (public.is_owner());

-- Owner can insert roles (or first user if no owner exists)
CREATE POLICY "owner_insert" ON user_roles
  FOR INSERT WITH CHECK (
    public.is_owner()
    OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner')
  );

-- Owner can update roles
CREATE POLICY "owner_update" ON user_roles
  FOR UPDATE USING (public.is_owner());

-- Owner can delete roles
CREATE POLICY "owner_delete" ON user_roles
  FOR DELETE USING (public.is_owner());
