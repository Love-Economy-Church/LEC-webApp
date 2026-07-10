import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://adtugmhftcjzswxtbyue.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
    console.log("=== Fetching all leaders ===");
    const { data: assignments, error } = await supabase
        .from('position_assignments')
        .select(`
            organizational_units (
                id,
                name,
                unit_type,
                parent_id
            ),
            people (
                id,
                full_name
            ),
            positions (
                title,
                level
            )
        `)
        .eq('is_active', true)
        .lt('positions.level', 5);

    if (error) {
        console.error(error);
        return;
    }

    const filtered = assignments.filter(a => a.positions && a.organizational_units && a.people);
    console.log(`Found ${filtered.length} active leadership assignments:`);
    filtered.forEach(a => {
        console.log(`Unit: ${a.organizational_units.name} (${a.organizational_units.unit_type})`);
        console.log(`  Leader: ${a.people.full_name}`);
        console.log(`  Position: ${a.positions.title} (Level ${a.positions.level})`);
        console.log(`  Parent ID: ${a.organizational_units.parent_id}`);
    });
}

main();
