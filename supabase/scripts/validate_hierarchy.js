import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from frontend
dotenv.config({ path: path.join(__dirname, '../../frontend/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const csvPath = path.join(__dirname, '../people_rows (1).csv');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function validate() {
    console.log('Starting Validation...');

    // 1. Load CSV
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });
    const csvMap = new Map(records.map(r => [r.id, r])); // Map ID -> Record

    console.log(`Loaded ${records.length} records from CSV.`);

    // 2. Load DB Data
    console.log('Fetching DB state...');

    // Get all people with their original_id
    const { data: people, error: pErr } = await supabase
        .from('people')
        .select('id, original_id, full_name');
    if (pErr) throw pErr;

    const peopleMap = new Map(people.map(p => [p.original_id, p])); // original_id -> DB Person
    const peopleIdMap = new Map(people.map(p => [p.id, p])); // DB ID -> DB Person

    // Get all active assignments
    const { data: assignments, error: aErr } = await supabase
        .from('position_assignments')
        .select('person_id, unit_id, is_active')
        .eq('is_active', true);
    if (aErr) throw aErr;

    // Map PersonID -> UnitID (assuming valid 1:1 for now)
    const assignmentMap = new Map(assignments.map(a => [a.person_id, a.unit_id]));

    // Get all units
    const { data: units, error: uErr } = await supabase
        .from('organizational_units')
        .select('id, name, parent_id, unit_type');
    if (uErr) throw uErr;

    const unitMap = new Map(units.map(u => [u.id, u]));

    // 3. Verify
    let stats = {
        total: records.length,
        found_in_db: 0,
        assigned: 0,
        valid_hierarchy: 0,
        same_unit_correct: 0, // e.g. Member -> Shepherd
        unit_link_missing: 0,
        errors: []
    };

    for (const record of records) {
        const dbPerson = peopleMap.get(record.id);
        if (!dbPerson) {
            stats.errors.push(`Missing Person: ${record.full_name} (${record.id})`);
            continue;
        }
        stats.found_in_db++;

        const unitId = assignmentMap.get(dbPerson.id);
        if (!unitId) {
            // Some people might not have assignments if they are just placeholders? 
            // But CSV implies they have roles.
            stats.errors.push(`No Active Assignment: ${record.full_name}`);
            continue;
        }
        stats.assigned++;

        const unit = unitMap.get(unitId);

        // Check Parent Relationship
        if (record.parent_id) {
            const csvParent = csvMap.get(record.parent_id);
            if (!csvParent) {
                // Parent not in CSV?
                continue;
            }

            const dbParent = peopleMap.get(csvParent.id);
            if (!dbParent) {
                stats.errors.push(`Parent Missing in DB: Parent of ${record.full_name}`);
                continue;
            }

            const parentUnitId = assignmentMap.get(dbParent.id);
            if (!parentUnitId) {
                stats.errors.push(`Parent Has No Assignment: Parent of ${record.full_name}`);
                continue;
            }

            const parentUnit = unitMap.get(parentUnitId);

            // CHECK:
            // 1. Are they in the same unit? (Member -> Shepherd)
            if (unitId === parentUnitId) {
                stats.same_unit_correct++;
            }
            // 2. Is ChildUnit.parent == ParentUnit.id? (Shepherd -> Head)
            else if (unit.parent_id === parentUnitId) {
                stats.valid_hierarchy++;
            }
            else {
                stats.unit_link_missing++;
                stats.errors.push(`Hierarchy Mismatch: ${record.full_name} (in ${unit.name}) reports to ${csvParent.full_name} (in ${parentUnit.name}). But ${unit.name} parent is ${unit.parent_id ? unitMap.get(unit.parent_id)?.name : 'NULL'}. Expected ${parentUnit.name}.`);
            }
        }
    }

    console.log('\n=== VALIDATION REPORT ===');
    console.log(`Total CSV Records: ${stats.total}`);
    console.log(`Found in DB: ${stats.found_in_db}`);
    console.log(`Have Assignments: ${stats.assigned}`);
    console.log(`Same Unit Links (Member->Leader): ${stats.same_unit_correct}`);
    console.log(`Cross Unit Links (Child->Parent Unit): ${stats.valid_hierarchy}`);
    console.log(`HIERARCHY MISMATCHES: ${stats.unit_link_missing}`);
    console.log('-------------------------');
    if (stats.errors.length > 0) {
        console.log('First 20 Errors:');
        stats.errors.slice(0, 20).forEach(e => console.log(`- ${e}`));
    }
}

validate().catch(console.error);
