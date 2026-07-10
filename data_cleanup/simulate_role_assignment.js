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

    console.log('--- Role Assignment Simulation ---');
    console.log('| Name | Original Role | Inferred Unit | Inferred Position | Status |');
    console.log('|---|---|---|---|---|');

    records.forEach(r => {
        const role = (r.role || '').trim();
        if (!role) return;

        // SKIP: Generic Placeholders or purely structural rows if any
        if (role === 'Cell' || role === 'MC') return;

        let unitName = 'UNKNOWN';
        let positionTitle = 'UNKNOWN';
        let status = 'PENDING';

        // LOGIC MIMIC (from migration.sql)

        // 1. Heads
        if (role.match(/ Head$/i)) {
            unitName = role.replace(/ Head$/i, '');
            // Start Normalization Hack from SQL
            if (unitName.match(/ SM$/i)) unitName = unitName.replace(/ SM$/i, ' MC');

            if (role === 'Zonal Head') {
                unitName = 'Zonal Office';
                positionTitle = 'Zonal Head';
                status = 'MATCHED';
            } else {
                // Infer level from unit name keywords? 
                // SQL looks up unit_type. Here we guess.
                if (unitName.includes('Buscenta')) positionTitle = 'Buscenta Head';
                else if (unitName.includes('MC')) positionTitle = 'MC Head';
                else positionTitle = 'Head (Generic)';
                status = 'MATCHED';
            }
        }
        // 2. Shepherds
        else if (role.match(/Shepherd/i)) {
            // Strategy 1: Regex extraction
            // SQL tries to find unit by name matching.
            // "KB2 Cell 02 Shepherd" -> Unit: "KB2 Cell 02"

            // Heuristic A: Remove " Shepherd"
            let tryName = role.replace(/ Shepherd/i, '');
            tryName = tryName.replace(/Shepherd /i, '');
            tryName = tryName.trim();

            unitName = tryName;

            // Check for Assistant
            if (role.match(/Assistant|Asst/i)) {
                positionTitle = 'Assistant Cell Shepherd';
            } else {
                positionTitle = 'Cell Shepherd';
            }
            status = 'MATCHED';
        }
        // 3. Members
        else if (role.match(/^Member of /i)) {
            unitName = role.substring(10).trim();
            positionTitle = 'Cell Member';
            status = 'MATCHED';
        }
        else {
            status = 'UNMATCHED';
        }

        console.log(`| ${r.full_name} | ${role} | ${unitName} | ${positionTitle} | ${status} |`);
    });

} catch (err) {
    console.error(err);
}
