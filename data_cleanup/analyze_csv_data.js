import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_PATH = path.join(__dirname, '../../supabase/people_rows_clean.csv');

try {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });

    const roleCounts = {};
    const nameCounts = {};
    const idMap = new Set();
    const issues = [];

    // 1. Build Index
    records.forEach(r => {
        idMap.add(r.id);

        // Count Names
        if (r.full_name) {
            nameCounts[r.full_name] = (nameCounts[r.full_name] || 0) + 1;
        }

        // Count Roles
        if (r.role) {
            roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
        }
    });

    // 2. Analyze
    records.forEach(r => {
        // Parent Check
        if (r.parent_id && !idMap.has(r.parent_id)) {
            issues.push(`[ORPHAN] ${r.full_name} has invalid parent_id: ${r.parent_id}`);
        }
    });

    const reportPath = path.join(__dirname, 'analysis_report.txt');
    let report = '';
    const log = (msg) => { console.log(msg); report += msg + '\n'; };

    log('--- Duplicate Roles (Potential Conflicts) ---');
    for (const [role, count] of Object.entries(roleCounts)) {
        if (count > 1 && role !== 'Cell' && role !== 'MC' && !role.startsWith('Member of')) {
            // "Head", "Shepherd" usually implies unique leader, unless co-leaders exist.
            // "Member of" roles are expected to be duplicated.
            log(`${count}x "${role}"`);

            // List who has them
            const holders = records.filter(r => r.role === role).map(r => r.full_name);
            log(`    Holders: ${holders.join(', ')}`);
        }
    }

    log('\n--- Duplicate Names ---');
    for (const [name, count] of Object.entries(nameCounts)) {
        if (count > 1 && name !== 'Pending Identity') {
            log(`${count}x "${name}"`);
            const roles = records.filter(r => r.full_name === name).map(r => r.role);
            log(`    Roles: ${roles.join(', ')}`);
        }
    }

    log('\n--- Special Stats ---');
    log(`Total Pending Identities: ${nameCounts['Pending Identity'] || 0}`);

    if (issues.length > 0) {
        log('\n--- Structural Issues ---');
        issues.forEach(i => log(i));
    }

    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`Report written to ${reportPath}`);

} catch (err) {
    console.error(err);
}
