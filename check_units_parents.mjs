import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://adtugmhftcjzswxtbyue.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
    const { data: units, error: uErr } = await supabase.from('organizational_units').select('*');
    if (uErr) { console.error(uErr); return; }

    const unitsMap = new Map(units.map(u => [u.id, u]));

    console.log("=== All Organizational Units & Parents ===");
    const sortedUnits = [...units].sort((a, b) => a.unit_type.localeCompare(b.unit_type) || a.name.localeCompare(b.name));
    
    for (const u of sortedUnits) {
        const parent = u.parent_id ? unitsMap.get(u.parent_id) : null;
        console.log(`Unit: "${u.name}" | Type: ${u.unit_type} | Parent: ${parent ? `"${parent.name}" (${parent.unit_type})` : 'None'}`);
    }
}

main();
