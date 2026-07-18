-- Migration: Add password change log table
-- This records every password change event.
-- NOTE: passwords are stored as plain text per admin requirement.
-- WARNING: Anyone with Supabase dashboard access can read all stored passwords.
-- Ensure your Supabase project has restricted dashboard access.

CREATE TABLE IF NOT EXISTS public.password_change_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id       UUID REFERENCES public.people(id) ON DELETE SET NULL,
  auth_user_id    UUID,
  full_name       TEXT,                         -- denormalised for easy reading
  changed_at      TIMESTAMPTZ DEFAULT now(),
  changed_by_self BOOLEAN DEFAULT true,
  new_password    TEXT,                         -- plain text (admin visibility)
  note            TEXT
);

ALTER TABLE public.password_change_log ENABLE ROW LEVEL SECURITY;

-- Only the service role can read/write this table
-- (accessed via edge function only, never from the client directly)
CREATE POLICY "Service role full access"
  ON public.password_change_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RPC for admins to safely read the password logs
CREATE OR REPLACE FUNCTION get_password_change_logs()
RETURNS TABLE (
  id UUID,
  person_id UUID,
  auth_user_id UUID,
  full_name TEXT,
  changed_at TIMESTAMPTZ,
  changed_by_self BOOLEAN,
  new_password TEXT,
  note TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role_level INTEGER;
BEGIN
  -- Get the position level of the calling auth user
  SELECT pos.level INTO v_caller_role_level
  FROM public.people p
  JOIN public.position_assignments pa ON p.id = pa.person_id
  JOIN public.positions pos ON pa.position_id = pos.id
  WHERE p.auth_user_id = auth.uid()
  AND p.is_active = true
  AND pa.is_active = true
  ORDER BY pos.level ASC
  LIMIT 1;

  -- Verify caller is an admin (level <= 3, e.g. Zonal Shepherd or higher)
  IF v_caller_role_level IS NULL OR v_caller_role_level > 3 THEN
    RAISE EXCEPTION 'Access Denied: You do not have permission to view password logs';
  END IF;

  RETURN QUERY
  SELECT 
    l.id,
    l.person_id,
    l.auth_user_id,
    l.full_name,
    l.changed_at,
    l.changed_by_self,
    l.new_password,
    l.note
  FROM public.password_change_log l
  ORDER BY l.changed_at DESC;
END;
$$;
