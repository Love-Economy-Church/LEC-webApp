
-- ============================================
-- 13. AUTHENTICATION AND AUTHORIZATION SCHEMA
-- ============================================

-- 1. Add auth_user_id to people table to link with Supabase Auth
ALTER TABLE people 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_people_auth_user_id ON people(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_people_email ON people(email);

-- 2. Function to get the current user's role/unit
-- This allows the frontend to easily fetch "Who am I?" context
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
    photo_url TEXT
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
        p.photo_url
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

-- 3. RLS Example (Optional - enforcing it on attendance_sessions)
-- Check if RLS is enabled, if not enable it
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see sessions for units they belong to (or children of their units)
-- For simplicity in this demo, we might allow authenticated users to see all, 
-- or implement strict RLS. Let's start with basic Authenticated access for now.

CREATE POLICY "Enable read access for authenticated users" ON attendance_sessions
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON attendance_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users" ON attendance_records
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON attendance_records
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
    
CREATE POLICY "Enable update for authenticated users" ON attendance_records
    FOR UPDATE
    TO authenticated
    USING (true);
