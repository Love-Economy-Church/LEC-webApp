-- Migration: Fix Google OAuth sign-in by syncing auth_user_id on every Google login
--
-- The problem:
--   When a user first links their Gmail via EmailGatePage, link_google_email() sets
--   auth_user_id = auth.uid() of the TRANSIENT OAuth session, then signs out.
--   On the NEXT Google sign-in, Supabase may issue a different auth.uid() for the same
--   Google account (especially if the transient session was cleaned up).
--   Result: auth_user_id on the people row is stale → get_current_user_role() falls back to
--   matching by personal_email ILIKE v_auth_email — which works, BUT auth_user_id stays wrong,
--   causing confusion on future logins.
--
-- The fix:
--   1. Add sync_google_auth_id() — called from the frontend after every successful Google sign-in.
--      It finds the person matched by personal_email and updates auth_user_id to the fresh UUID.
--   2. Tighten get_current_user_role() to always normalise email comparison (LOWER/TRIM).

-- ── 1. Sync function ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_google_auth_id()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_id    UUID;
  v_auth_email VARCHAR;
  v_rows       INTEGER;
BEGIN
  v_auth_id    := auth.uid();
  
  -- Get the Google-provided email from auth.users
  SELECT LOWER(TRIM(email))
  INTO   v_auth_email
  FROM   auth.users
  WHERE  id = v_auth_id;

  IF v_auth_email IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Update auth_user_id to the current (fresh) Google session UUID
  -- for any person whose personal_email matches this Google email.
  -- Also handles the edge case where someone already matched by auth_user_id.
  UPDATE public.people
  SET    auth_user_id = v_auth_id
  WHERE  (
           LOWER(TRIM(personal_email)) = v_auth_email
           OR auth_user_id = v_auth_id
         )
  AND    is_active = TRUE
  AND    email_verified = TRUE;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN v_rows > 0;
END;
$$;

-- Grant execute to authenticated users (each user only touches their own row
-- because we use auth.uid() internally — SECURITY DEFINER protects the rest).
GRANT EXECUTE ON FUNCTION public.sync_google_auth_id() TO authenticated;


-- ── 2. Tighten get_current_user_role to use normalised comparison ────────────
DROP FUNCTION IF EXISTS get_current_user_role();

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TABLE (
    user_id        UUID,
    person_id      UUID,
    full_name      VARCHAR,
    position_title VARCHAR,
    unit_id        UUID,
    unit_name      VARCHAR,
    unit_type      VARCHAR,
    level          INTEGER,
    photo_url      TEXT,
    email_verified BOOLEAN,
    personal_email VARCHAR,
    churchone_email VARCHAR,
    phone          VARCHAR,
    dob            DATE,
    social_handle  VARCHAR
) SECURITY DEFINER
AS $$
DECLARE
    v_auth_id    UUID;
    v_auth_email VARCHAR;
BEGIN
    v_auth_id    := auth.uid();

    -- Normalise the auth email (Google always provides lowercase but let's be safe)
    SELECT LOWER(TRIM(email))
    INTO   v_auth_email
    FROM   auth.users
    WHERE  id = v_auth_id;

    RETURN QUERY
    SELECT
        v_auth_id                  AS user_id,
        p.id                       AS person_id,
        p.full_name,
        pos.title                  AS position_title,
        ou.id                      AS unit_id,
        ou.name                    AS unit_name,
        ou.unit_type,
        pos.level,
        p.photo_url,
        p.email_verified,
        p.personal_email,
        p.email                    AS churchone_email,
        p.phone,
        p.dob,
        p.social_handle
    FROM   people p
    JOIN   position_assignments pa  ON p.id           = pa.person_id
    JOIN   positions            pos ON pa.position_id  = pos.id
    JOIN   organizational_units ou  ON pa.unit_id      = ou.id
    WHERE  (
              p.auth_user_id                    = v_auth_id
              OR LOWER(TRIM(p.email))           = v_auth_email
              OR LOWER(TRIM(p.personal_email))  = v_auth_email
           )
    AND    p.is_active  = TRUE
    AND    pa.is_active = TRUE
    ORDER  BY pos.level ASC, pa.start_date DESC
    LIMIT  1;
END;
$$ LANGUAGE plpgsql;
