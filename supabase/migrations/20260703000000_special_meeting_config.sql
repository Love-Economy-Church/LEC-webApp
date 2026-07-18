-- Migration: Special Meeting Configuration and Permissions
-- 1. Create the configuration table
CREATE TABLE IF NOT EXISTS public.special_meeting_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_name VARCHAR(255) NOT NULL,
    meeting_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.people(id)
);

-- 2. Enable RLS
ALTER TABLE public.special_meeting_config ENABLE ROW LEVEL SECURITY;

-- 3. Create helper function to check if a user has the highest rank in the system
CREATE OR REPLACE FUNCTION public.is_highest_rank(p_auth_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_min_level INTEGER;
    v_user_level INTEGER;
BEGIN
    -- Get the minimum level configured in the system (normally Level 1)
    SELECT MIN(level) INTO v_min_level FROM public.positions;
    
    -- Get the calling user's highest level (lowest integer number)
    SELECT MIN(pos.level) INTO v_user_level
    FROM public.people p
    JOIN public.position_assignments pa ON p.id = pa.person_id
    JOIN public.positions pos ON pa.position_id = pos.id
    WHERE p.auth_user_id = p_auth_id
      AND p.is_active = true
      AND pa.is_active = true;
      
    RETURN COALESCE(v_user_level = v_min_level, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create RLS Policies
DROP POLICY IF EXISTS "Allow select for all authenticated users" ON public.special_meeting_config;
CREATE POLICY "Allow select for all authenticated users" 
    ON public.special_meeting_config FOR SELECT 
    TO authenticated 
    USING (true);

DROP POLICY IF EXISTS "Allow write for highest rank" ON public.special_meeting_config;
CREATE POLICY "Allow write for highest rank" 
    ON public.special_meeting_config FOR ALL 
    TO authenticated 
    USING (public.is_highest_rank(auth.uid()))
    WITH CHECK (public.is_highest_rank(auth.uid()));
