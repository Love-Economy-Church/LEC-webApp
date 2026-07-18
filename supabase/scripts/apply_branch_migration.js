import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load dotenv from frontend
dotenv.config({ path: path.join(__dirname, '../../frontend/.env') });

const migrationFile = path.join(__dirname, '../migrations/20260624010000_add_branch_level_and_rename_roles.sql');
const token = process.env.SUPABASE_ACCESS_KEY || process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
    console.error("Error: SUPABASE_ACCESS_KEY / SUPABASE_ACCESS_TOKEN not found in .env");
    process.exit(1);
}

// Set target root ID from database query
const REAL_ROOT_ID = '19dbf8c9-24dc-44e8-8230-02eaff08d949';
const OLD_ROOT_ID = '03e6c6af-a128-4315-8bd2-02b100b9d474';

console.log("Reading migration SQL...");
let sqlContent = fs.readFileSync(migrationFile, 'utf8');

if (sqlContent.includes(OLD_ROOT_ID)) {
    console.log(`Replacing old root ID (${OLD_ROOT_ID}) with real root ID (${REAL_ROOT_ID})...`);
    sqlContent = sqlContent.replaceAll(OLD_ROOT_ID, REAL_ROOT_ID);
    fs.writeFileSync(migrationFile, sqlContent, 'utf8');
    console.log("Migration file updated successfully.");
} else {
    console.log("No old root ID found in migration file. Already updated or different.");
}

console.log("Executing SQL migration via Supabase CLI...");
// Run the query command
const cmd = `npx supabase db query --linked --file "${migrationFile}"`;

const env = { ...process.env, SUPABASE_ACCESS_TOKEN: token };

const child = exec(cmd, { env, cwd: path.join(__dirname, '../..') }, (error, stdout, stderr) => {
    if (error) {
        console.error(`Execution error: ${error.message}`);
        console.error(`Stderr: ${stderr}`);
        process.exit(1);
    }
    console.log(`Stdout: ${stdout}`);
    if (stderr) {
        console.warn(`Stderr warning: ${stderr}`);
    }
    console.log("SQL Migration completed successfully!");
});
