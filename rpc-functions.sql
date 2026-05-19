-- ============================================================
-- FIX: Supabase RPC for getting user role (bypasses RLS)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Create a SECURITY DEFINER function to get the current user's role.
-- This runs with elevated privileges, bypassing the RLS policies on user_roles
-- that were causing the infinite recursion (500) errors.

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid();
$$;

-- Also create a function to bootstrap the owner role (bypassing RLS)
CREATE OR REPLACE FUNCTION bootstrap_owner_role(owner_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_role text;
BEGIN
  -- Get current user id and email
  v_user_id := auth.uid();
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Check if they match the required email
  IF v_email = owner_email THEN
    -- Check if owner role already exists
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner') THEN
      -- Insert owner role
      INSERT INTO public.user_roles (user_id, email, role, assigned_by)
      VALUES (v_user_id, v_email, 'owner', v_user_id)
      ON CONFLICT (user_id) DO UPDATE SET role = 'owner';
      RETURN 'owner';
    END IF;
  END IF;
  
  -- Return their existing role if any
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = v_user_id;
  RETURN v_role;
END;
$$;
