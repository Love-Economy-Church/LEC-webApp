import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://adtugmhftcjzswxtbyue.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
    const names = [
        "Beverly Mensah",
        "Regina Amedagbui",
        "Caleb Yorke",
        "Edh Obiri Yeboah",
        "Samuel William Dodoo",
        "Jesse Asanab",
        "Edwin Aveh",
        "Beatrice Darkoa Baah"
    ];

    console.log("=== Fetching targeted assignments ===");
    for (const name of names) {
        const { data: people, error: pErr } = await supabase
            .from('people')
            .select('id, full_name')
            .ilike('full_name', `%${name}%`);
        
        if (pErr) {
            console.error(pErr);
            continue;
        }

        if (!people || people.length === 0) {
            console.log(`Person not found: ${name}`);
            continue;
        }

        for (const person of people) {
            const { data: assignments, error: aErr } = await supabase
                .from('position_assignments')
                .select(`
                    id,
                    is_active,
                    is_primary,
                    organizational_units (
                        id,
                        name,
                        unit_type
                    ),
                    positions (
                        id,
                        title,
                        level,
                        unit_type
                    )
                `)
                .eq('person_id', person.id);
            
            if (aErr) {
                console.error(aErr);
                continue;
            }

            console.log(`\nPerson: ${person.full_name} (${person.id})`);
            if (!assignments || assignments.length === 0) {
                console.log("  No assignments found.");
            } else {
                assignments.forEach(a => {
                    console.log(`  Assignment:`);
                    console.log(`    Active: ${a.is_active}`);
                    console.log(`    Primary: ${a.is_primary}`);
                    console.log(`    Unit: ${a.organizational_units?.name} (${a.organizational_units?.unit_type})`);
                    console.log(`    Position: ${a.positions?.title} (Level: ${a.positions?.level}, Unit Type: ${a.positions?.unit_type})`);
                });
            }
        }
    }
}

main();
