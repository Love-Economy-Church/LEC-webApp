import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = "https://adtugmhftcjzswxtbyue.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM";

const supabase = createClient(supabaseUrl, serviceRoleKey);

const scratchDir = "C:\\Users\\Elikplim Adonoo\\.gemini\\antigravity\\brain\\6999177c-60bb-456b-b475-94498effdcfe\\scratch";

async function main() {
    console.log("=== Fetching Organizational Units ===");
    const { data: units, error: unitsError } = await supabase
        .from('organizational_units')
        .select('*');
    
    if (unitsError) {
        console.error(unitsError);
        return;
    }
    fs.writeFileSync(path.join(scratchDir, 'units.json'), JSON.stringify(units, null, 2));
    console.log(`Saved ${units.length} units to units.json`);

    console.log("\n=== Fetching Active Position Assignments ===");
    const { data: assignments, error: assignError } = await supabase
        .from('position_assignments')
        .select(`
            id,
            unit_id,
            person_id,
            is_active,
            is_primary,
            people (
                id,
                full_name,
                is_placeholder
            ),
            positions (
                id,
                title,
                level,
                unit_type
            )
        `)
        .eq('is_active', true);
    
    if (assignError) {
        console.error(assignError);
        return;
    }
    fs.writeFileSync(path.join(scratchDir, 'assignments.json'), JSON.stringify(assignments, null, 2));
    console.log(`Saved ${assignments.length} assignments to assignments.json`);
}

main();
