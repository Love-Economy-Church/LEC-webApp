-- Migration: Fix private_messages RLS policies by using a robust SECURITY DEFINER helper function.
-- This helper matches users either by their auth_user_id or by their authenticated email address,
-- ensuring that users with dual login methods (Google OAuth vs password) resolve to the same profile.

-- Drop old policies
DROP POLICY IF EXISTS "Enable read access for participants" ON public.private_messages;
DROP POLICY IF EXISTS "Enable insert access for sender" ON public.private_messages;

-- Create robust helper function to get person_id for the current auth user
CREATE OR REPLACE FUNCTION public.get_my_person_id()
RETURNS UUID AS $$
DECLARE
  v_auth_email TEXT;
  v_person_id UUID;
BEGIN
  -- 1. Try matching by auth_user_id directly
  SELECT id INTO v_person_id FROM public.people WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_person_id IS NOT NULL THEN
    RETURN v_person_id;
  END IF;

  -- 2. Fallback: match by email or personal_email
  v_auth_email := LOWER(COALESCE(
    auth.jwt()->>'email',
    (SELECT email FROM auth.users WHERE id = auth.uid())
  ));
  
  IF v_auth_email IS NOT NULL AND v_auth_email <> '' THEN
    SELECT id INTO v_person_id 
    FROM public.people 
    WHERE email ILIKE v_auth_email OR personal_email ILIKE v_auth_email 
    LIMIT 1;
    
    RETURN v_person_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policies using the helper function
CREATE POLICY "Enable read access for participants" ON public.private_messages
    FOR SELECT TO authenticated
    USING (
        sender_id = public.get_my_person_id()
        OR recipient_id = public.get_my_person_id()
    );

CREATE POLICY "Enable insert access for sender" ON public.private_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = public.get_my_person_id()
    );
