import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, '../../supabase/people_rows_clean.csv');
const OUTPUT_FILE = path.join(__dirname, '../../supabase/people_rows_deduped.csv');

// Typo map
const TYPO_FIXES = {
    'Sheperd': 'Shepherd',
    'Shepehrd': 'Shepherd'
};

try {
    const inputContent = fs.readFileSync(INPUT_FILE, 'utf-8');
    const records = parse(inputContent, { columns: true, skip_empty_lines: true });

    const seenKeyMap = new Map(); // Key: "Name|Role" -> Record
    const idRedirects = new Map(); // Old ID -> New ID (for parent_id updates)
    const uniqueRecords = [];
    const duplicates = [];

    // Pass 1: Deduplicate & Fix Typos
    for (const record of records) {
        // 1. Fix Typos in Role
        let role = record.role || '';
        for (const [bad, good] of Object.entries(TYPO_FIXES)) {
            if (role.includes(bad)) {
                role = role.replace(bad, good);
            }
        }
        record.role = role;

        // 2. Normalize Key
        // Key = "FullName|Role" (case insensitive)
        const key = `${record.full_name.trim().toLowerCase()}|${record.role.trim().toLowerCase()}`;

        if (seenKeyMap.has(key)) {
            // Found duplicate
            const existing = seenKeyMap.get(key);

            // Logic: Keep the one that looks "better" (e.g. active, or earlier/later id?)
            // For now, simple logic: Keep the FIRST one encountered, merge ID pointing to it.
            // Wait, usually the row order in CSV might be random or sorted by created_at.
            // In the previous file, duplicated Jesse Asanab had one 'true' active and one 'false' active.
            // We should prefer ACTIVE over inactive.

            // If existing is inactive but new one is active, swap them.
            const existingActive = (String(existing.active) === 'true');
            const newActive = (String(record.active) === 'true');

            if (!existingActive && newActive) {
                // Swap: Start using the NEW record as the master
                // Redirect OLD -> NEW
                idRedirects.set(existing.id, record.id);

                // Replace in map and unique list
                seenKeyMap.set(key, record);
                const idx = uniqueRecords.findIndex(r => r.id === existing.id);
                if (idx !== -1) uniqueRecords[idx] = record;

                duplicates.push(`Replaced inactive duplicate: ${record.full_name} (${existing.id} -> ${record.id})`);
            } else {
                // Keep existing, discard new
                // Redirect NEW -> OLD
                idRedirects.set(record.id, existing.id);
                duplicates.push(`Skipped duplicate: ${record.full_name} (${record.id} -> ${existing.id})`);
            }

        } else {
            // New unique
            seenKeyMap.set(key, record);
            uniqueRecords.push(record);
        }
    }

    // Pass 2: Fix Reference Integrity (parent_id)
    // If we removed a record that was someone's parent, we must update the child's parent_id.
    let updatedParents = 0;
    for (const record of uniqueRecords) {
        if (record.parent_id && idRedirects.has(record.parent_id)) {
            const newParentId = idRedirects.get(record.parent_id);
            // console.log(`Remapping parent for ${record.full_name}: ${record.parent_id} -> ${newParentId}`);
            record.parent_id = newParentId;
            updatedParents++;
        }
    }

    // Output
    const outputContent = stringify(uniqueRecords, { header: true });
    fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf-8');

    console.log(`Processed ${records.length} records.`);
    console.log(`Found ${duplicates.length} duplicates (removed).`);
    console.log(`Updated ${updatedParents} parent references.`);
    console.log(`Wrote ${uniqueRecords.length} unique records to ${OUTPUT_FILE}`);

    // Log duplicates for review
    duplicates.forEach(d => console.log(d));

} catch (err) {
    console.error(err);
}
