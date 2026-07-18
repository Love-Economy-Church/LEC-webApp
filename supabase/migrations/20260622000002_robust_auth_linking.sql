-- 1. Update get_current_user_role to match by email in addition to auth_user_id.
-- This ensures that a user can log in with EITHER their password-based @churchone.com account
-- OR their linked Google OAuth account without being locked out.
DROP FUNCTION IF EXISTS get_current_user_role();

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TABLE (
    user_id UUID,
    person_id UUID,
    full_name VARCHAR,
    position_title VARCHAR,
    unit_id UUID,
    unit_name VARCHAR,
    unit_type VARCHAR,
    level INTEGER,
    photo_url TEXT,
    email_verified BOOLEAN,
    personal_email VARCHAR,
    churchone_email VARCHAR
) SECURITY DEFINER
AS $$
DECLARE
    v_auth_id UUID;
    v_auth_email VARCHAR;
BEGIN
    v_auth_id := auth.uid();
    
    -- Get the authenticated user's email
    SELECT email INTO v_auth_email
    FROM auth.users
    WHERE id = v_auth_id;
    
    RETURN QUERY
    SELECT 
        v_auth_id as user_id,
        p.id as person_id,
        p.full_name,
        pos.title as position_title,
        ou.id as unit_id,
        ou.name as unit_name,
        ou.unit_type,
        pos.level,
        p.photo_url,
        p.email_verified,
        p.personal_email,
        p.email as churchone_email
    FROM people p
    JOIN position_assignments pa ON p.id = pa.person_id
    JOIN positions pos ON pa.position_id = pos.id
    JOIN organizational_units ou ON pa.unit_id = ou.id
    WHERE (p.auth_user_id = v_auth_id OR p.email ILIKE v_auth_email OR p.personal_email ILIKE v_auth_email)
    AND p.is_active = true
    AND pa.is_active = true
    ORDER BY pos.level ASC, pa.start_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 2. Update link_google_email to also associate the auth_user_id with the Google auth user
CREATE OR REPLACE FUNCTION public.link_google_email(
  p_person_id UUID,
  p_gmail     TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := LOWER(TRIM(p_gmail));

  IF v_email = '' OR v_email IS NULL THEN
    RAISE EXCEPTION 'Gmail address cannot be empty.';
  END IF;

  IF v_email LIKE '%@churchone.com' THEN
    RAISE EXCEPTION 'Cannot link a @churchone.com email as a personal email.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.people
    WHERE id = p_person_id AND email_verified = TRUE
  ) THEN
    RAISE EXCEPTION 'This account already has a verified email linked.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.people
    WHERE personal_email = v_email AND id != p_person_id
  ) THEN
    RAISE EXCEPTION 'This Gmail is already linked to another ChurchOne account.';
  END IF;

  -- Save the verified Gmail, mark as verified, and associate the Google auth_user_id
  UPDATE public.people
  SET personal_email = v_email,
      email_verified  = TRUE,
      auth_user_id    = auth.uid()
  WHERE id = p_person_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Person record not found. Contact your admin.';
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update the foreign key constraint to use ON DELETE SET NULL.
-- This prevents "Database error deleting user" by automatically unlinking the profile
-- when an auth user (like an orphaned Google account) is deleted.
ALTER TABLE public.people
DROP CONSTRAINT IF EXISTS people_auth_user_id_fkey,
ADD CONSTRAINT people_auth_user_id_fkey 
  FOREIGN KEY (auth_user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;
