-- Add DELETE policy for attendance_sessions and attendance_records
-- This allows leaders to successfully undo attendance sessions

CREATE POLICY "Enable delete for authenticated users" ON attendance_sessions
    FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Enable delete for authenticated users" ON attendance_records
    FOR DELETE
    TO authenticated
    USING (true);
