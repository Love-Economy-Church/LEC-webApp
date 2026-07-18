-- Migration: Add extended profile fields to people table and update role RPC
ALTER TABLE public.people 
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS dob DATE,
ADD COLUMN IF NOT EXISTS social_handle VARCHAR(255);

-- Update get_current_user_role function to return the new fields
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
    churchone_email VARCHAR,
    phone VARCHAR,
    dob DATE,
    social_handle VARCHAR
) SECURITY DEFINER
AS $$
DECLARE
    v_auth_id UUID;
    v_auth_email VARCHAR;
BEGIN
    v_auth_id := auth.uid();
    
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
        p.email as churchone_email,
        p.phone,
        p.dob,
        p.social_handle
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
