-- ============================================
-- Add service_name to attendance_sessions
-- Enables service-based attendance tracking
-- (Mega Gathering Service, LC Live, Special Meeting)
-- ============================================

-- 1. Add service_name column
ALTER TABLE attendance_sessions
  ADD COLUMN IF NOT EXISTS service_name VARCHAR(100) DEFAULT NULL;

-- 2. Drop the old unique constraint (unit_id, session_date)
--    and replace with (unit_id, session_date, service_name)
--    so multiple services can exist on the same day for the same unit.
ALTER TABLE attendance_sessions
  DROP CONSTRAINT IF EXISTS attendance_sessions_unit_id_session_date_key;

-- Create the new unique constraint
ALTER TABLE attendance_sessions
  ADD CONSTRAINT attendance_sessions_unit_date_service_key 
  UNIQUE (unit_id, session_date, service_name);

-- 3. Backfill existing sessions with a default service_name
UPDATE attendance_sessions
  SET service_name = 'Mega Gathering Service'
  WHERE service_name IS NULL;

-- 4. Make service_name NOT NULL going forward
ALTER TABLE attendance_sessions
  ALTER COLUMN service_name SET NOT NULL;

-- 5. Drop and recreate the analytics view to include service_name
DROP VIEW IF EXISTS attendance_analytics_view;

CREATE OR REPLACE VIEW attendance_analytics_view AS
SELECT 
    s.id as session_id,
    s.session_date,
    s.unit_id,
    s.service_name,
    s.first_timers_count,
    s.souls_won_count,
    u.name as unit_name,
    u.unit_type,
    u.parent_id,
    COUNT(r.id) as total_marked,
    COUNT(CASE WHEN r.status = 'PRESENT' THEN 1 END) as total_present,
    COUNT(CASE WHEN r.status = 'ABSENT' THEN 1 END) as total_absent,
    ROUND(
        (COUNT(CASE WHEN r.status = 'PRESENT' THEN 1 END)::DECIMAL / NULLIF(COUNT(r.id), 0)) * 100, 
        2
    ) as attendance_rate
FROM attendance_sessions s
JOIN organizational_units u ON s.unit_id = u.id
LEFT JOIN attendance_records r ON s.id = r.session_id
GROUP BY s.id, s.session_date, s.unit_id, s.service_name, s.first_timers_count, s.souls_won_count,
         u.name, u.unit_type, u.parent_id;
