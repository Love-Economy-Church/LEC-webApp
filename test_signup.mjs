import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://adtugmhftcjzswxtbyue.supabase.co';
const anonKey = 'sb_publishable_q8jFXnU24-8cE1Q7MsdOZA_3xJtRC7h'; // Use the anon key, as signUp is called by clients

const supabase = createClient(supabaseUrl, anonKey);

async function main() {
    console.log("=== TESTING SIGNUP WITH ANON KEY ===");
    const dummyEmail = `test_dummy_${Date.now()}@example.com`;
    const { data, error } = await supabase.auth.signUp({
        email: dummyEmail,
        password: 'TemporaryPassword123!'
    });
    
    if (error) {
        console.log("Signup returned error:", error.message, "| status:", error.status);
    } else {
        console.log("Signup succeeded! User ID:", data.user?.id);
        // Clean up
        const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM';
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
        console.log("Cleaned up dummy user.");
    }
}

main().catch(console.error);
