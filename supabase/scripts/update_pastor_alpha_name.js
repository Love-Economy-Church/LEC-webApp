import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://adtugmhftcjzswxtbyue.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const personId = 'f082e66a-115f-4a0b-8d4a-38d5f308a0d9';
const newName = 'Rev. Essiam';
const newEmail = 'rev.essiam@alpha.com';

async function main() {
    // 1. Get the auth_user_id so we can update auth email too
    console.log("Fetching Pastor Alpha record...");
    const { data: person, error: fetchErr } = await supabase
        .from('people')
        .select('id, full_name, email, auth_user_id')
        .eq('id', personId)
        .single();

    if (fetchErr || !person) {
        console.error("Could not find person:", fetchErr?.message);
        process.exit(1);
    }
    console.log(`Found: ${person.full_name} | email: ${person.email} | auth_user_id: ${person.auth_user_id}`);

    // 2. Update auth user email
    if (person.auth_user_id) {
        console.log(`Updating auth user email to ${newEmail}...`);
        const { error: authErr } = await supabase.auth.admin.updateUserById(person.auth_user_id, {
            email: newEmail,
            email_confirm: true,
            user_metadata: { full_name: newName }
        });
        if (authErr) {
            console.error("Failed to update auth email:", authErr.message);
            process.exit(1);
        }
        console.log("Auth email updated.");
    } else {
        console.warn("No auth_user_id found — skipping auth update.");
    }

    // 3. Update people record
    console.log(`Updating people record: name → ${newName}, email → ${newEmail}...`);
    const { error: updateErr } = await supabase
        .from('people')
        .update({ full_name: newName, email: newEmail })
        .eq('id', personId);

    if (updateErr) {
        console.error("Failed to update people record:", updateErr.message);
        process.exit(1);
    }

    console.log("Done! Rev. Essiam's name and email have been updated successfully.");
    console.log(`  Name:  ${newName}`);
    console.log(`  Email: ${newEmail}`);
}

main();
