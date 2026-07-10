import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CHANGED: Pointing to deduped file
const CSV_PATH = path.join(__dirname, '../../supabase/people_rows_deduped.csv');
const MIGRATION_PATH = path.join(__dirname, '../../supabase/migration.sql');

function escapeSql(val) {
    if (val === null || val === undefined || val === '') return 'NULL';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    // Escape single quotes for SQL
    return `'${String(val).replace(/'/g, "''")}'`;
}

try {
    // 1. Read CSV
    console.log(`Reading CSV from ${CSV_PATH}...`);
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });

    // 2. Read Migration File
    console.log('Reading Migration SQL...');
    let sqlContent = fs.readFileSync(MIGRATION_PATH, 'utf-8');

    // 3. Generate New INSERT Block
    // Target format: 
    // INSERT INTO raw_people_data (id, full_name, parent_id, photo_url, active, is_placeholder, original_role) VALUES
    const insertHeader = `INSERT INTO raw_people_data (id, full_name, parent_id, photo_url, active, is_placeholder, original_role) VALUES`;

    const valueNotations = records.map(r => {
        return `(${escapeSql(r.id)}, ${escapeSql(r.full_name)}, ${escapeSql(r.parent_id)}, ${escapeSql(r.photo_url)}, ${escapeSql(r.active)}, ${escapeSql(r.is_placeholder)}, ${escapeSql(r.role)})`;
    });

    const newInsertBlock = `${insertHeader}\n    ${valueNotations.join(',\n    ')};`;

    // 4. Regex Replace for INSERT BLOCK
    const startIndex = sqlContent.indexOf('INSERT INTO raw_people_data');
    if (startIndex === -1) throw new Error('Could not find INSERT INTO raw_people_data block');

    // Find end of block (semicolon before the next section)
    // We expect the next section to start with "-- Now clean" or similar context we saw before
    // Or we just find the semicolon for THIS insert logic.
    // The previous logic used specific markers. Let's look for the first semicolon after start.
    // However, since we already ran this once, the file might look different?
    // In `migration.sql` now, it has "INSERT INTO raw_people_data ... VALUES ... ;" then "-- Now clean..."

    let endIndex = sqlContent.indexOf(';', startIndex);

    // To be safe against semicolons in strings, we can verify.
    // But our data is simple.
    // Let's ensure it's the right one.
    // Just finding the first semicolon might be enough for this big block.

    if (endIndex === -1) throw new Error('Could not find end of INSERT block');

    console.log(`Replacing block from char ${startIndex} to ${endIndex + 1}`);

    let newSql = sqlContent.substring(0, startIndex) +
        newInsertBlock +
        sqlContent.substring(endIndex + 1);

    // 5. Update CREATE TEMPORARY TABLE (Remove created_at if present)
    // It might ALREADY be removed if we ran the script before.
    // But regex replace is safe if it doesn't match.
    newSql = newSql.replace(/^\s*created_at TIMESTAMP WITH TIME ZONE,\s*$/m, '');

    // 6. Update CTE "cleaned_data" selection (Ensure NOW() is used)
    // Previous state might be "NOW() as created_at," or "created_at," depending on if I rolled back.
    // We want to force it to "NOW() as created_at,"
    // Regex: find "created_at," or "NOW() as created_at," followed by "active,"
    // Only replace if it's the bare "created_at,"
    // Actually, if it's already "NOW() as created_at,", we leave it?
    // Or just blindly replace "created_at," with "NOW() as created_at," if it's NOT preceded by "as ".

    // Safest: Look for the specific lines in relevant context.
    // Context: "photo_url," -> "created_at," -> "active,"
    // We want: "photo_url," -> "NOW() as created_at," -> "active,"

    // If it was already patched, it looks like:
    // photo_url,
    // NOW() as created_at,
    // active,

    // If unpatched:
    // photo_url,
    // created_at,
    // active,

    newSql = newSql.replace(/photo_url,\s+created_at,\s+active,/s, 'photo_url,\n        NOW() as created_at,\n        active,');

    // 7. Update ORDER BY in CTE (Remove created_at sort)
    // Unpatched: "created_at DESC,"
    // Patched: (line gone)
    newSql = newSql.replace(/^\s*created_at DESC,\s*--.*$/m, '');

    fs.writeFileSync(MIGRATION_PATH, newSql, 'utf-8');
    console.log('Migration file updated successfully.');

} catch (err) {
    console.error('Error:', err);
}
