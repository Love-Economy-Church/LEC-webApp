-- 1. Add personal_email to people table
ALTER TABLE people ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);

-- 2. Create the RPC for email resolution
-- This function allows the frontend to resolve a personal email to the primary auth email (churchone.com)
CREATE OR REPLACE FUNCTION get_login_email(input_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    resolved_email TEXT;
BEGIN
    -- First check if the input matches any generated church email
    SELECT email INTO resolved_email
    FROM people
    WHERE email ILIKE input_email
    LIMIT 1;

    IF resolved_email IS NOT NULL THEN
        RETURN resolved_email;
    END IF;

    -- If not, check if it matches a personal email
    -- We return the church email because that is what they are registered with in Auth
    SELECT email INTO resolved_email
    FROM people
    WHERE personal_email ILIKE input_email
    LIMIT 1;

    IF resolved_email IS NOT NULL THEN
        RETURN resolved_email;
    END IF;

    -- If no match found, just return the input
    RETURN input_email;
END;
$$;
