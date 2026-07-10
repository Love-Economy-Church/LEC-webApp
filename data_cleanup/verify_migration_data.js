import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = path.join(__dirname, '../../supabase/people_rows_deduped.csv');
const MIGRATION_PATH = path.join(__dirname, '../../supabase/migration.sql');

try {
    console.log('--- Verification Started ---');

    // 1. Load CSV Records
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const csvRecords = parse(csvContent, { columns: true, skip_empty_lines: true });

    const csvMap = new Map();
    csvRecords.forEach(r => csvMap.set(r.id, r));

    console.log(`CSV Records: ${csvRecords.length}`);

    // 2. Parse Migration SQL
    const sqlContent = fs.readFileSync(MIGRATION_PATH, 'utf-8');

    // Extract the VALUES block
    // It starts after "INSERT INTO raw_people_data ... VALUES"
    // And ends with ";"

    const startMarker = 'INSERT INTO raw_people_data (id, full_name, parent_id, photo_url, active, is_placeholder, original_role) VALUES';
    const startIndex = sqlContent.indexOf(startMarker);

    if (startIndex === -1) throw new Error('Could not find INSERT block in SQL');

    const blockStart = startIndex + startMarker.length;
    const blockEnd = sqlContent.indexOf(';', blockStart);

    if (blockEnd === -1) throw new Error('Could not find end of INSERT block in SQL');

    const valuesBlock = sqlContent.substring(blockStart, blockEnd).trim();

    // Parse SQL Values
    // Format: ('id', 'name', 'parent', 'url', 'active', 'placeholder', 'role'), (...)
    // We need to parse this somewhat robustly.
    // Simple regex for valid UUIDs at start of group: \('([0-9a-f-]+)',

    // Let's split by "), (" roughly? Or use a regex to capture each row.
    // Row pattern: \((.*?)\)
    // Careful with nested parens, but our data is simple.

    // Matches: ( ... )
    const rowMatches = valuesBlock.match(/\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/g);

    if (!rowMatches) throw new Error('Failed to parse SQL value rows');

    console.log(`SQL Records: ${rowMatches.length}`);

    const sqlMap = new Map();

    rowMatches.forEach(rowStr => {
        // Strip outer parens
        const content = rowStr.slice(1, -1);

        // Split by comma, respecting quotes?
        // Simple CSV parse again on the single line?
        // Since it's SQL format 'val', 'val', we can replace ' with " and parse as CSV line?
        // But need to handle NULL -> null

        // Custom parser for SQL values
        // We know the columns: id, full_name, parent_id, photo_url, active, is_placeholder, original_role

        // Remove 'true'/'false' quotes if any (our update script put raw booleans I think?)
        // Let's just create a quick cleaner.

        const cleanContent = content.replace(/'/g, '').replace(/NULL/g, '');
        // This is lossy if names have commas.
        // Better: use a regex to capture fields. 

        // But wait, the update script used:
        // `(${escapeSql(r.id)}, ${escapeSql(r.full_name)}, ...)`
        // escapeSql wraps strings in single quotes.

        // Let's assume ID is always 36 chars.
        const id = content.match(/'([0-9a-f-]{36})'/)[1];

        sqlMap.set(id, { raw: content });
    });

    // 3. Compare
    let mismatchCount = 0;

    // A. Check CSV -> SQL
    for (const [id, record] of csvMap) {
        if (!sqlMap.has(id)) {
            console.error(`[MISSING IN SQL] ID: ${id} Name: ${record.full_name}`);
            mismatchCount++;
        }
    }

    // B. Check SQL -> CSV
    for (const [id, _] of sqlMap) {
        if (!csvMap.has(id)) {
            console.error(`[EXTRA IN SQL] ID: ${id}`);
            mismatchCount++;
        }
    }

    if (mismatchCount === 0) {
        if (csvRecords.length === rowMatches.length) {
            console.log('SUCCESS: Exact match verified! (Count and IDs)');
        } else {
            console.log(`WARNING: Count mismatch but all IDs found? CSV=${csvRecords.length}, SQL=${rowMatches.length}`);
        }
    } else {
        console.log(`FAILURE: Found ${mismatchCount} discrepancies.`);
    }

} catch (err) {
    console.error(err);
}
