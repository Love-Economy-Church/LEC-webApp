-- Module 10: Add first_timers_count and souls_won_count to attendance_sessions

ALTER TABLE attendance_sessions
  ADD COLUMN IF NOT EXISTS first_timers_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS souls_won_count INTEGER NOT NULL DEFAULT 0;

-- Drop and recreate the analytics view to include the new columns
DROP VIEW IF EXISTS attendance_analytics_view;

CREATE OR REPLACE VIEW attendance_analytics_view AS
SELECT 
    s.id as session_id,
    s.session_date,
    s.unit_id,
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
GROUP BY s.id, s.session_date, s.unit_id, s.first_timers_count, s.souls_won_count,
         u.name, u.unit_type, u.parent_id;

-- Gap Fix: attendance_sessions was missing an UPDATE RLS policy,
-- causing upserts (re-submissions for the same day) to silently fail.
CREATE POLICY "Enable update for authenticated users" ON attendance_sessions
    FOR UPDATE
    TO authenticated
    USING (true);

