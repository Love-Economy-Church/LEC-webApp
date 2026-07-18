-- Migration: Add Branch level and rename Zonal Head to Church Head
-- 1. Temporarily allow BRANCH and CHURCH in check constraints
ALTER TABLE public.organizational_units DROP CONSTRAINT IF EXISTS organizational_units_unit_type_check;
ALTER TABLE public.organizational_units ADD CONSTRAINT organizational_units_unit_type_check CHECK (unit_type IN ('BRANCH', 'CHURCH', 'MC', 'BUSCENTA', 'CELL', 'ZONE'));

ALTER TABLE public.positions DROP CONSTRAINT IF EXISTS positions_unit_type_check;
ALTER TABLE public.positions ADD CONSTRAINT positions_unit_type_check CHECK (unit_type IN ('BRANCH', 'CHURCH', 'MC', 'BUSCENTA', 'CELL', 'ZONE'));

-- 2. Shift levels in positions table (increment all by 1)
-- Level 1 (Zone) -> Level 2
-- Level 2 (MC) -> Level 3
-- Level 3 (Buscenta) -> Level 4
-- Level 4 (Cell Shepherd / Shepherd) -> Level 5
-- Level 5 (Cell Member) -> Level 6
-- Level 6 (First Timer) -> Level 7
UPDATE public.positions SET level = level + 1;

-- 3. Insert Branch Pastor position as Level 1
INSERT INTO public.positions (id, title, description, unit_type, level)
VALUES (
    'e0f6b3e8-54b9-4702-86ee-c926dfbc30cf',
    'Branch Pastor',
    'Overall Branch Leadership',
    'BRANCH',
    1
);

-- 4. Update Zonal Head position to Church Head (Level 2) and unit_type CHURCH
UPDATE public.positions
SET title = 'Church Head',
    description = 'Church level leadership',
    unit_type = 'CHURCH'
WHERE title = 'Zonal Head';

-- 5. Update existing organizational units from ZONE to CHURCH
UPDATE public.organizational_units SET unit_type = 'CHURCH' WHERE unit_type = 'ZONE';

-- 6. Enforce strict check constraints excluding ZONE
ALTER TABLE public.organizational_units DROP CONSTRAINT IF EXISTS organizational_units_unit_type_check;
ALTER TABLE public.organizational_units ADD CONSTRAINT organizational_units_unit_type_check CHECK (unit_type IN ('BRANCH', 'CHURCH', 'MC', 'BUSCENTA', 'CELL'));

ALTER TABLE public.positions DROP CONSTRAINT IF EXISTS positions_unit_type_check;
ALTER TABLE public.positions ADD CONSTRAINT positions_unit_type_check CHECK (unit_type IN ('BRANCH', 'CHURCH', 'MC', 'BUSCENTA', 'CELL'));

-- 7. Rename the existing "Zone" unit (original root) to "Alpha Branch" and change its type to BRANCH
UPDATE public.organizational_units
SET name = 'Alpha Branch',
    unit_type = 'BRANCH'
WHERE id = '19dbf8c9-24dc-44e8-8230-02eaff08d949';

-- 8. Create the "ChurchOne" unit under "Alpha Branch"
INSERT INTO public.organizational_units (id, name, unit_type, parent_id, is_placeholder)
VALUES (
    '7b41fdcd-3a34-4f4d-b397-05d6f9c50c63',
    'ChurchOne',
    'CHURCH',
    '19dbf8c9-24dc-44e8-8230-02eaff08d949',
    false
);

-- 9. Reparent all existing MCs to be under 'ChurchOne'
UPDATE public.organizational_units
SET parent_id = '7b41fdcd-3a34-4f4d-b397-05d6f9c50c63'
WHERE parent_id = '19dbf8c9-24dc-44e8-8230-02eaff08d949'
AND id != '7b41fdcd-3a34-4f4d-b397-05d6f9c50c63';

-- 10. Update Rev. Giorgio Mensah's position assignment to be under 'ChurchOne'
UPDATE public.position_assignments
SET unit_id = '7b41fdcd-3a34-4f4d-b397-05d6f9c50c63'
WHERE person_id = (SELECT id FROM public.people WHERE full_name = 'Rev. Giorgio Mensah' LIMIT 1);

-- 11. Add ChurchTwo, ChurchThree, ChurchFour under "Alpha Branch"
INSERT INTO public.organizational_units (id, name, unit_type, parent_id, is_placeholder)
VALUES 
('c57e8d3b-6e9f-4db4-a690-0f04e8d35702', 'ChurchTwo', 'CHURCH', '19dbf8c9-24dc-44e8-8230-02eaff08d949', false),
('d29a5f4e-28b3-4c91-9e75-b6d4f9715203', 'ChurchThree', 'CHURCH', '19dbf8c9-24dc-44e8-8230-02eaff08d949', false),
('a49c7f6e-1d5b-48c0-82a1-e403d5267b04', 'ChurchFour', 'CHURCH', '19dbf8c9-24dc-44e8-8230-02eaff08d949', false);

-- 12. Create the new person "Pastor Alpha" and assign as Branch Pastor of "Alpha Branch"
INSERT INTO public.people (id, full_name, photo_url, is_active, is_placeholder)
VALUES (
    'f082e66a-115f-4a0b-8d4a-38d5f308a0d9',
    'Pastor Alpha',
    NULL,
    true,
    false
);

INSERT INTO public.position_assignments (id, person_id, position_id, unit_id, is_primary, start_date, is_active)
VALUES (
    gen_random_uuid(),
    'f082e66a-115f-4a0b-8d4a-38d5f308a0d9',
    'e0f6b3e8-54b9-4702-86ee-c926dfbc30cf',
    '19dbf8c9-24dc-44e8-8230-02eaff08d949',
    true,
    CURRENT_DATE,
    true
);

-- 13. Recreate the public.get_admin_password_logs function to reflect level > 4
CREATE OR REPLACE FUNCTION get_admin_password_logs()
RETURNS TABLE (
  log_id UUID,
  person_id UUID,
  auth_user_id UUID,
  full_name VARCHAR,
  changed_at TIMESTAMP WITH TIME ZONE,
  changed_by_self BOOLEAN,
  changed_by_id UUID,
  changed_by_name VARCHAR,
  action_type VARCHAR
)
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role_level INTEGER;
BEGIN
  -- Get the position level of the calling auth user
  SELECT pos.level INTO v_caller_role_level
  FROM public.people p
  JOIN public.position_assignments pa ON p.id = pa.person_id
  JOIN public.positions pos ON pa.position_id = pos.id
  WHERE p.auth_user_id = auth.uid()
  AND p.is_active = true
  AND pa.is_active = true
  ORDER BY pos.level ASC
  LIMIT 1;

  -- Verify caller is an admin (level <= 4, e.g. MC Head/Church Head/Branch Pastor or higher)
  IF v_caller_role_level IS NULL OR v_caller_role_level > 4 THEN
    RAISE EXCEPTION 'Access Denied: You do not have permission to view password logs';
  END IF;

  RETURN QUERY
  SELECT 
    l.id,
    l.person_id,
    l.auth_user_id,
    l.full_name,
    l.changed_at,
    l.changed_by_self,
    l.changed_by_id,
    l.changed_by_name,
    l.action_type
  FROM public.password_change_log l
  ORDER BY l.changed_at DESC;
END;
$$ LANGUAGE plpgsql;
