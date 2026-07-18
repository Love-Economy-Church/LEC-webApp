-- ============================================================
-- Fix first_timers_count in all attendance_sessions
--
-- Previously, first_timers_count was computed using a pipeline
-- that incorrectly included regular members (Cell Member, Member)
-- in the First Timer / Brethren states based on their attendance
-- count. This inflated the stored first_timers_count.
--
-- The correct rule: only people whose assigned position title
-- is exactly 'First Timer' should be counted here.
-- ============================================================

UPDATE attendance_sessions s
SET first_timers_count = (
    SELECT COUNT(DISTINCT ar.person_id)
    FROM attendance_records ar
    WHERE ar.session_id = s.id
      AND ar.status = 'PRESENT'
      AND EXISTS (
          SELECT 1
          FROM position_assignments pa
          JOIN positions pos ON pos.id = pa.position_id
          WHERE pa.person_id = ar.person_id
            AND pa.is_active = true
            AND pos.title = 'First Timer'
      )
);
