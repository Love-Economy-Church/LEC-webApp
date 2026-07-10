// One-time script: fix first_timers_count in all attendance_sessions
// Run with: node fix_first_timers_count.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://adtugmhftcjzswxtbyue.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM'
);

async function fixFirstTimersCount() {
  console.log('Fetching all attendance sessions...');

  // Get all sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('attendance_sessions')
    .select('id, session_date, service_name, first_timers_count');

  if (sessionsError) {
    console.error('Error fetching sessions:', sessionsError);
    process.exit(1);
  }

  console.log(`Found ${sessions.length} sessions. Recomputing first_timers_count for each...`);

  let fixed = 0;
  let unchanged = 0;

  for (const session of sessions) {
    // Count PRESENT attendance_records for this session where person has 'First Timer' position
    const { data: records, error: recordsError } = await supabase
      .from('attendance_records')
      .select('person_id, status, person:people(assignments:position_assignments(is_active, position:positions(title)))')
      .eq('session_id', session.id)
      .eq('status', 'PRESENT');

    if (recordsError) {
      console.error(`Error fetching records for session ${session.id}:`, recordsError);
      continue;
    }

    // Count only those whose active position title is exactly 'First Timer'
    const trueFirstTimerCount = records.filter(r => {
      const assignments = r.person?.assignments || [];
      return assignments.some(a => a.is_active && a.position?.title === 'First Timer');
    }).length;

    if (trueFirstTimerCount === session.first_timers_count) {
      unchanged++;
      continue;
    }

    // Update the session with the correct count
    const { error: updateError } = await supabase
      .from('attendance_sessions')
      .update({ first_timers_count: trueFirstTimerCount })
      .eq('id', session.id);

    if (updateError) {
      console.error(`Error updating session ${session.id}:`, updateError);
    } else {
      console.log(`  Session ${session.session_date} (${session.service_name}): ${session.first_timers_count} → ${trueFirstTimerCount}`);
      fixed++;
    }
  }

  console.log(`\nDone. ${fixed} sessions corrected, ${unchanged} already correct.`);
}

fixFirstTimersCount();
