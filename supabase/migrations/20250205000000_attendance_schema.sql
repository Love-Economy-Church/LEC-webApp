
-- ============================================
-- 8. ATTENDANCE TRACKING SYSTEM
-- ============================================

-- Table to track attendance sessions (e.g., a specific Cell meeting on a specific date)
CREATE TABLE attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES organizational_units(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES people(id), -- The person who marked it (e.g. Cell Shepherd)
    notes TEXT,
    CONSTRAINT chk_future_date CHECK (session_date <= CURRENT_DATE),
    UNIQUE(unit_id, session_date) -- Prevent duplicate sessions for same unit on same day
);

-- Table to track individual attendance records
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, person_id)
);

-- Index for faster analytics queries
CREATE INDEX idx_attendance_records_session ON attendance_records(session_id);
CREATE INDEX idx_attendance_records_person ON attendance_records(person_id);
CREATE INDEX idx_attendance_sessions_unit_date ON attendance_sessions(unit_id, session_date);
CREATE INDEX idx_attendance_sessions_date ON attendance_sessions(session_date);

-- View for Attendance Analytics (Aggregated by Session)
CREATE OR REPLACE VIEW attendance_analytics_view AS
SELECT 
    s.id as session_id,
    s.session_date,
    s.unit_id,
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
GROUP BY s.id, s.session_date, s.unit_id, u.name, u.unit_type, u.parent_id;
