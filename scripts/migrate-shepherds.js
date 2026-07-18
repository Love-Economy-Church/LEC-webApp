require('dotenv').config({ path: '../frontend/.env' }); // Adjust path if needed or just use process.env
const { createClient } = require('@supabase/supabase-js');

// CONFIGURATION
// You must provide the SERVICE_ROLE_KEY (Admin Key) for this to work.
// It allows bypassing RLS and managing Auth Users.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    console.error('Please make sure you have a .env file with these values.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function migrateShepherds() {
    console.log('--- Starting Shepherd Migration ---');

    // 1. Fetch all Active Leaders
    console.log('Fetching Cell Shepherds, Buscenta Heads, MC Heads, and Zonal Heads...');
    const { data: assignments, error: fetchError } = await supabase
        .from('position_assignments')
        .select(`
            person_id,
            people ( id, full_name, auth_user_id ),
            positions ( title )
        `)
        .eq('is_active', true)
        .in('positions.title', ['Cell Shepherd', 'Buscenta Head', 'MC Head', 'Zonal Head']);

    if (fetchError) {
        console.error('Error fetching assignments:', fetchError);
        return;
    }

    // Filter out those who already have an account (auth_user_id is not null)
    // Note: In real logic, "people" is an object, but if position_assignments returns array,
    // we need to access the joined data correctly.
    // Supabase returns { people: { ... }, positions: { ... } }
    
    // Flatten list
    const shepherds = assignments
        .map(a => a.people)
        .filter(p => !p.auth_user_id); // Only those without accounts

    console.log(`Found ${shepherds.length} shepherds needing accounts.`);

    let successCount = 0;
    let failCount = 0;

    for (const person of shepherds) {
        const names = person.full_name.trim().split(' ');
        const firstName = names[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        const lastName = names.length > 1 ? names[names.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '') : 'shepherd';
        
        // Generate Email: firstname.lastname@churchone.com
        const email = `${firstName}.${lastName}@churchone.com`;
        const password = 'aTTendance.0123'; // Default temporary password

        console.log(`Creating account for: ${person.full_name} (${email})...`);

        try {
            // 2. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true, // Auto-confirm
                user_metadata: { full_name: person.full_name }
            });

            if (authError) {
                // If user already exists, try to get their ID to link anyway? 
                // For now, just error out.
                console.error(`  Failed to create auth user: ${authError.message}`);
                failCount++;
                continue;
            }

            const newUserId = authData.user.id;

            // 3. Link to People Record
            const { error: updateError } = await supabase
                .from('people')
                .update({ auth_user_id: newUserId, email: email })
                .eq('id', person.id);

            if (updateError) {
                console.error(`  Failed to link person record: ${updateError.message}`);
                // Optional: Delete the orphaned auth user? 
                failCount++;
            } else {
                console.log(`  Success! Linked.`);
                successCount++;
            }

        } catch (err) {
            console.error(`  Unexpected error: ${err.message}`);
            failCount++;
        }
    }

    console.log('--- Migration Complete ---');
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
}

migrateShepherds();
