-- get_email_auth_mode: returns the correct auth mode for a given email
-- 'google'   -> email is a verified personal Gmail linked to a profile
-- 'unlinked' -> email looks personal but is NOT linked to any profile
-- 'password' -> fallback (only used for unexpected cases; frontend handles @churchone.com separately)
CREATE OR REPLACE FUNCTION public.get_email_auth_mode(input_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_verified BOOLEAN;
    v_found    BOOLEAN;
BEGIN
    -- Only match on personal_email (Gmail).
    -- ChurchOne @churchone.com emails always use password auth and should never match here.
    SELECT email_verified, TRUE INTO v_verified, v_found
    FROM public.people
    WHERE personal_email ILIKE LOWER(TRIM(input_email))
    LIMIT 1;

    IF v_found IS TRUE AND v_verified = TRUE THEN
        RETURN 'google';   -- verified, linked Gmail -> Google Sign-In mode
    ELSE
        RETURN 'unlinked'; -- Gmail not found in any profile -> show "not linked" message
    END IF;
END;
$$;

-- Grant execute permissions to public/anonymous users (so they can call it before logging in)
GRANT EXECUTE ON FUNCTION public.get_email_auth_mode(TEXT) TO anon, authenticated;
