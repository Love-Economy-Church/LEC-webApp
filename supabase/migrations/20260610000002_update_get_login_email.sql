-- Migration: Update get_login_email to support users who have updated their primary auth email to their personal email.
-- This ensures that when a user logs in with either their churchone email or personal email,
-- it resolves to the actual active email in auth.users.

CREATE OR REPLACE FUNCTION get_login_email(input_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auth_email TEXT;
BEGIN
    -- 1. Try to find the actual active email in auth.users for this person (if they linked it)
    SELECT au.email INTO v_auth_email
    FROM public.people p
    JOIN auth.users au ON p.auth_user_id = au.id
    WHERE p.email ILIKE input_email OR p.personal_email ILIKE input_email
    LIMIT 1;

    IF v_auth_email IS NOT NULL THEN
        RETURN v_auth_email;
    END IF;

    -- 2. Fallback: if not linked yet or auth user not found, resolve using the old logic
    -- First check if the input matches any generated church email
    SELECT email INTO v_auth_email
    FROM public.people
    WHERE email ILIKE input_email
    LIMIT 1;

    IF v_auth_email IS NOT NULL THEN
        RETURN v_auth_email;
    END IF;

    -- If not, check if it matches a personal email
    SELECT email INTO v_auth_email
    FROM public.people
    WHERE personal_email ILIKE input_email
    LIMIT 1;

    IF v_auth_email IS NOT NULL THEN
        RETURN v_auth_email;
    END IF;

    RETURN input_email;
END;
$$;
