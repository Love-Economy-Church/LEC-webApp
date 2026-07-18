import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationPath = path.join(__dirname, '../migration.sql');
const insertsPath = path.join(__dirname, 'generated_inserts.sql');

try {
    let migration = fs.readFileSync(migrationPath, 'utf-8');
    const inserts = fs.readFileSync(insertsPath, 'utf-8');

    // Extract just the INSERT part from generated file (skip CREATE TABLE)
    const insertStart = inserts.indexOf('INSERT INTO');
    const newInsertBlock = inserts.substring(insertStart);

    // Find range to replace in migration.sql
    // Look for the INSERT statement
    const oldInsertStart = migration.indexOf('INSERT INTO raw_people_data (id, full_name, photo_url');

    if (oldInsertStart === -1) {
        // Maybe the column list is different now? I updated the file earlier!
        // I updated it to: INSERT INTO raw_people_data (id, full_name, role, parent_id... in my thought?
        // No, I updated the CREATE TABLE definition. The INSERT statement was NOT updated yet.
        // So search for the OLD insert signature.
        // "INSERT INTO raw_people_data (id, full_name, photo_url, created_at, active, is_placeholder, original_role) VALUES"
        console.error('Could not find old INSERT start signature. Searching fuzzily...');
    }

    // Actually, I can search for "INSERT INTO raw_people_data" generally.
    const oldUniqStart = migration.indexOf('INSERT INTO raw_people_data');
    if (oldUniqStart === -1) { throw new Error('Could not find INSERT start'); }

    // Find the end. It ends before "WITH cleaned_data AS"
    const oldEnd = migration.indexOf('WITH cleaned_data AS', oldUniqStart);
    if (oldEnd === -1) { throw new Error('Could not find INSERT end'); }

    // Check closest semicolon before oldEnd
    const blockEnd = migration.lastIndexOf(';', oldEnd);

    // Splice
    const before = migration.substring(0, oldUniqStart);
    const after = migration.substring(blockEnd + 1);

    const newMigration = before + newInsertBlock + after;

    fs.writeFileSync(migrationPath, newMigration);
    console.log('Successfully patched migration.sql');

} catch (err) {
    console.error(err);
}
