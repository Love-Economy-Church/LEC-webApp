-- Migration: Add ONLINE status to attendance records
-- Drop the check constraint on status and recreate it with 'ONLINE'
ALTER TABLE attendance_records 
  DROP CONSTRAINT IF EXISTS attendance_records_status_check,
  ADD CONSTRAINT attendance_records_status_check 
  CHECK (status IN ('PRESENT', 'ABSENT', 'ONLINE'));

-- Recreate the view to support counting physical and online attendance separately
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
    COUNT(CASE WHEN r.status = 'ONLINE' THEN 1 END) as total_online,
    COUNT(CASE WHEN r.status = 'ABSENT' THEN 1 END) as total_absent,
    ROUND(
        ((COUNT(CASE WHEN r.status = 'PRESENT' THEN 1 END) + COUNT(CASE WHEN r.status = 'ONLINE' THEN 1 END))::DECIMAL / NULLIF(COUNT(r.id), 0)) * 100, 
        2
    ) as attendance_rate
FROM attendance_sessions s
JOIN organizational_units u ON s.unit_id = u.id
LEFT JOIN attendance_records r ON s.id = r.session_id
GROUP BY s.id, s.session_date, s.unit_id, s.service_name, s.first_timers_count, s.souls_won_count,
         u.name, u.unit_type, u.parent_id;
