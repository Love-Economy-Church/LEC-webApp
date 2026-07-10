import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = path.join(__dirname, '../../supabase/people_rows_deduped.csv');

try {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });

    const roleMap = {};

    // Group by role
    records.forEach(r => {
        if (!r.role) return;
        if (!roleMap[r.role]) roleMap[r.role] = [];
        roleMap[r.role].push(r);
    });

    const redundantPlaceholders = [];
    const coShepherds = [];

    for (const [role, holders] of Object.entries(roleMap)) {
        if (holders.length > 1) {
            // Check for Pending Identity
            const pendings = holders.filter(r => r.full_name === 'Pending Identity');
            const reals = holders.filter(r => r.full_name !== 'Pending Identity');

            if (pendings.length > 0 && reals.length > 0) {
                // Redundant Placeholder Case
                redundantPlaceholders.push({
                    role,
                    keep: reals.map(r => r.full_name),
                    remove: `Pending Identity (x${pendings.length})`
                });
            } else if (reals.length > 1) {
                // Co-Shepherd Case (Multiple Real People)
                if (role !== 'Cell' && role !== 'MC' && !role.startsWith('Member of')) {
                    coShepherds.push({
                        role,
                        people: reals.map(r => r.full_name)
                    });
                }
            }
        }
    }

    console.log('--- Redundant Placeholders (To Delete) ---');
    redundantPlaceholders.forEach(item => {
        console.log(`Role: "${item.role}"`);
        console.log(`  Keep: ${item.keep.join(', ')}`);
        console.log(`  Remove: ${item.remove}`);
    });

    console.log('\n--- Co-Shepherds (Decision Needed) ---');
    coShepherds.forEach(item => {
        console.log(`Role: "${item.role}"`);
        console.log(`  Holders: ${item.people.join(', ')}`);
    });

} catch (err) {
    console.error(err);
}
