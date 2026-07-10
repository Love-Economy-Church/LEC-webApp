import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://adtugmhftcjzswxtbyue.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
    const targetUserId = 'e2dc328c-f27c-4a6d-a3fb-d17950945c45'; // Jesse's old password user ID
    
    console.log("Checking references to old user id:", targetUserId);

    // Check people
    const { data: people, error: pError } = await supabase
        .from('people')
        .select('id, full_name, auth_user_id')
        .eq('auth_user_id', targetUserId);
    console.log("people references:", people);

    // Check password_change_log
    const { data: logs, error: lError } = await supabase
        .from('password_change_log')
        .select('id, full_name, auth_user_id')
        .eq('auth_user_id', targetUserId);
    console.log("password_change_log references:", logs);
}

main().catch(console.error);
