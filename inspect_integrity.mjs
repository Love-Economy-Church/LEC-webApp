import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://adtugmhftcjzswxtbyue.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
    console.log("--- Fetching Units & Assignments ---");
    const { data: units, error: uErr } = await supabase.from('organizational_units').select('*');
    if (uErr) { console.error(uErr); return; }

    const { data: assignments, error: aErr } = await supabase
        .from('position_assignments')
        .select('*, people(*), positions(*)')
        .eq('is_active', true);
    if (aErr) { console.error(aErr); return; }

    const unitsMap = new Map(units.map(u => [u.id, u]));

    console.log("\n--- Checking Unit Hierarchy Mismatches ---");
    // Hierarchy: ZONE -> MC -> BUSCENTA -> CELL
    units.forEach(u => {
        if (!u.parent_id) {
            console.log(`Root Unit: ${u.name} (${u.unit_type})`);
            return;
        }
        const parent = unitsMap.get(u.parent_id);
        if (!parent) {
            console.log(`ERROR: Unit ${u.name} (${u.unit_type}) has invalid parent ID: ${u.parent_id}`);
            return;
        }

        // Validate types
        if (u.unit_type === 'CELL' && parent.unit_type !== 'BUSCENTA') {
            console.log(`VIOLATION: CELL ${u.name} has parent ${parent.name} of type ${parent.unit_type} (expected BUSCENTA)`);
        } else if (u.unit_type === 'BUSCENTA' && parent.unit_type !== 'MC') {
            console.log(`VIOLATION: BUSCENTA ${u.name} has parent ${parent.name} of type ${parent.unit_type} (expected MC)`);
        } else if (u.unit_type === 'MC' && parent.unit_type !== 'ZONE') {
            console.log(`VIOLATION: MC ${u.name} has parent ${parent.name} of type ${parent.unit_type} (expected ZONE)`);
        }
    });

    console.log("\n--- Checking Position Assignment Type Mismatches ---");
    assignments.forEach(a => {
        const unit = unitsMap.get(a.unit_id);
        if (!unit) {
            console.log(`ERROR: Assignment ${a.id} has invalid unit ID: ${a.unit_id}`);
            return;
        }
        const position = a.positions;
        if (!position) {
            console.log(`ERROR: Assignment ${a.id} has no position`);
            return;
        }
        const personName = a.people ? a.people.full_name : 'Unknown';

        // Check if position.unit_type matches unit.unit_type
        if (position.unit_type && position.unit_type !== unit.unit_type) {
            console.log(`VIOLATION: Person ${personName} has position "${position.title}" (for ${position.unit_type}) assigned to unit "${unit.name}" (${unit.unit_type})`);
        }
    });
}

main();
