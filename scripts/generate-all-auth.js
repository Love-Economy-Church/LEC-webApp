require('dotenv').config({ path: require('path').resolve(__dirname, '../frontend/.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    console.error('Please make sure you have a .env file with these values in the frontend directory.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function generateAllAuth() {
    console.log('--- Starting Global Auth Generation ---');

    // 1. Fetch all people without auth_user_id
    console.log('Fetching people without authentication profiles...');
    
    let allPeople = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('people')
            .select('id, full_name, email')
            .is('auth_user_id', null)
            .range(page * pageSize, (page + 1) * pageSize - 1);
            
        if (error) {
            console.error('Error fetching people:', error);
            return;
        }
        
        allPeople = allPeople.concat(data);
        if (data.length < pageSize) {
            hasMore = false;
        } else {
            page++;
        }
    }

    console.log(`Found ${allPeople.length} people needing accounts.`);

    let successCount = 0;
    let failCount = 0;
    
    // We keep track of used emails locally as well
    const usedEmails = new Set();

    for (let i = 0; i < allPeople.length; i++) {
        const person = allPeople[i];
        
        if (!person.full_name) {
             console.warn(`Skipping person ID ${person.id} due to missing full_name`);
             failCount++;
             continue;
        }

        const names = person.full_name.trim().split(' ');
        const firstName = names[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'member';
        const lastName = names.length > 1 ? names[names.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '') : 'member';
        
        let baseEmail = `${firstName}.${lastName}@churchone.com`;
        
        // Try to respect existing emails if they exist, but fallback to generated if it fails
        if (person.email && person.email.includes('@')) {
           baseEmail = person.email;
        }
        
        let finalEmail = baseEmail;
        let counter = 1;
        
        // Ensure email uniqueness locally for this run
        while (usedEmails.has(finalEmail)) {
             const emailParts = baseEmail.split('@');
             finalEmail = `${emailParts[0]}${counter}@${emailParts[1]}`;
             counter++;
        }
        
        usedEmails.add(finalEmail);

        const password = 'aTTendance.0123';

        console.log(`[${i+1}/${allPeople.length}] Creating account for: ${person.full_name} (${finalEmail})...`);

        try {
            let authData, authError;
            
            // Try to create the user, handling "already registered" errors
            while (true) {
                const result = await supabase.auth.admin.createUser({
                    email: finalEmail,
                    password: password,
                    email_confirm: true,
                    user_metadata: { full_name: person.full_name }
                });
                
                authData = result.data;
                authError = result.error;

                if (authError && authError.message.toLowerCase().includes('already registered')) {
                    const emailParts = baseEmail.split('@');
                    finalEmail = `${emailParts[0]}${counter}@${emailParts[1]}`;
                    counter++;
                    usedEmails.add(finalEmail);
                    console.log(`  Email taken, retrying with ${finalEmail}...`);
                } else {
                    break; // Success or a different error we can't recover from
                }
            }

            if (authError) {
                console.error(`  Failed to create auth user: ${authError.message}`);
                failCount++;
                continue;
            }

            const newUserId = authData.user.id;

            // 3. Link to People Record
            const { error: updateError } = await supabase
                .from('people')
                .update({ auth_user_id: newUserId, email: finalEmail })
                .eq('id', person.id);

            if (updateError) {
                console.error(`  Failed to link person record: ${updateError.message}`);
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

    console.log('--- Generation Complete ---');
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
}

generateAllAuth();
