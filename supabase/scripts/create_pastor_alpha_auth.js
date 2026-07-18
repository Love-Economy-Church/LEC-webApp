import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from frontend
dotenv.config({ path: path.join(__dirname, '../../frontend/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function main() {
    const personId = 'f082e66a-115f-4a0b-8d4a-38d5f308a0d9';
    const email = 'pastor.alpha@churchone.com';
    const password = 'aTTendance.0123';

    console.log(`Checking if person with ID ${personId} exists...`);
    const { data: person, error: fetchErr } = await supabase
        .from('people')
        .select('*')
        .eq('id', personId)
        .single();

    if (fetchErr || !person) {
        console.error('Could not find Pastor Alpha in people table:', fetchErr?.message);
        process.exit(1);
    }

    console.log('Creating auth user...');
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: person.full_name }
    });

    if (authErr) {
        console.error('Failed to create auth user:', authErr.message);
        // If already registered, we can try to retrieve and link it.
        if (authErr.message.includes('already registered')) {
            console.log('Retrieving existing user by email...');
            // Try to find the user in auth to link it
            const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
            if (listErr) {
                console.error('Failed to list users:', listErr.message);
                process.exit(1);
            }
            const existingUser = users.users.find(u => u.email === email);
            if (existingUser) {
                console.log(`Found existing user with ID: ${existingUser.id}. Linking...`);
                await linkPerson(personId, existingUser.id, email);
            } else {
                console.error('User not found in auth user list.');
                process.exit(1);
            }
        } else {
            process.exit(1);
        }
    } else {
        const newUserId = authData.user.id;
        console.log(`Auth user created successfully! ID: ${newUserId}`);
        await linkPerson(personId, newUserId, email);
    }
}

async function linkPerson(personId, authUserId, email) {
    console.log(`Updating people record for Pastor Alpha with auth_user_id = ${authUserId} and email = ${email}...`);
    const { error: updateErr } = await supabase
        .from('people')
        .update({
            auth_user_id: authUserId,
            email: email
        })
        .eq('id', personId);

    if (updateErr) {
        console.error('Failed to link people record:', updateErr.message);
        process.exit(1);
    }

    console.log('Pastor Alpha linked successfully!');
}

main();
