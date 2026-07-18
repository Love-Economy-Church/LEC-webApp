import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://adtugmhftcjzswxtbyue.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log("Fetching organizational_units...");
  const { data: units, error: uErr } = await supabase.from('organizational_units').select('*');
  if (uErr) {
    console.error("Units error:", uErr);
    return;
  }
  console.log(`Fetched ${units.length} units.`);

  console.log("Fetching positions...");
  const { data: positions, error: pErr } = await supabase.from('positions').select('*');
  if (pErr) {
    console.error("Positions error:", pErr);
    return;
  }
  console.log(`Fetched ${positions.length} positions.`);

  console.log("Fetching position_assignments...");
  const { data: ass, error: aErr } = await supabase.from('position_assignments').select('*');
  if (aErr) {
    console.error("Assignments error:", aErr);
    return;
  }
  console.log(`Fetched ${ass.length} assignments.`);
}

main();
