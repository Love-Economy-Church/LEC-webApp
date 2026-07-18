-- Migration: Add email_verified flag for personal email gate
-- This tracks whether a user has completed the personal email linking step.

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Mark existing users who already have a personal_email as verified
-- (they don't need to go through the gate)
UPDATE public.people
  SET email_verified = true
  WHERE personal_email IS NOT NULL AND personal_email <> '';

-- Mark placeholder people as verified so the gate only affects real active users
UPDATE public.people
  SET email_verified = true
  WHERE is_placeholder = true;

-- Drop and recreate get_current_user_role to return email_verified and personal_email
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
    personal_email VARCHAR
) SECURITY DEFINER -- Runs with elevated privileges to read auth.users if needed
AS $$
DECLARE
    v_auth_id UUID;
BEGIN
    v_auth_id := auth.uid();
    
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
        p.personal_email
    FROM people p
    JOIN position_assignments pa ON p.id = pa.person_id
    JOIN positions pos ON pa.position_id = pos.id
    JOIN organizational_units ou ON pa.unit_id = ou.id
    WHERE p.auth_user_id = v_auth_id
    AND p.is_active = true
    AND pa.is_active = true
    -- If multiple roles, prioritize the highest level (lowest number)
    ORDER BY pos.level ASC, pa.start_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update people table when user verifies their personal email
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If the email has changed and it does not end with @churchone.com,
  -- update the corresponding people record.
  IF (OLD.email IS DISTINCT FROM NEW.email) AND (NEW.email NOT LIKE '%@churchone.com') THEN
    UPDATE public.people
    SET personal_email = NEW.email,
        email_verified = true
    WHERE auth_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_email_update();

-- Trigger to automatically link profile on new Auth user registration (e.g. Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_people_id UUID;
BEGIN
  -- First try to match by personal_email
  SELECT id INTO v_people_id
  FROM public.people
  WHERE personal_email ILIKE NEW.email
  LIMIT 1;

  -- If not found, try to match by churchone email
  IF v_people_id IS NULL THEN
    SELECT id INTO v_people_id
    FROM public.people
    WHERE email ILIKE NEW.email
    LIMIT 1;
  END IF;

  IF v_people_id IS NOT NULL THEN
    -- Link the existing person record to this auth user
    UPDATE public.people
    SET auth_user_id = NEW.id,
        email_verified = true
    WHERE id = v_people_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();


