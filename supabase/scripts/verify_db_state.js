import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env vars from parent directory (frontend root)
// Load env vars from frontend
dotenv.config({ path: path.join(process.cwd(), '../../frontend/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpData() {
    console.log('Fetching people_positions...');
    const { data: positions, error: posError } = await supabase
        .from('people_positions')
        .select('*')
        .eq('assignment_active', true)
        .order('unit_name');

    if (posError) {
        console.error('Error fetching positions:', posError);
        return;
    }

    console.log('Fetching organizational_units...');
    const { data: units, error: unitError } = await supabase
        .from('organizational_units')
        .select('*')
        .order('unit_type')
        .order('name');

    if (unitError) {
        console.error('Error fetching units:', unitError);
        return;
    }

    const output = {
        timestamp: new Date().toISOString(),
        total_assignments: positions.length,
        total_units: units.length,
        units_summary: units.reduce((acc, u) => {
            acc[u.unit_type] = (acc[u.unit_type] || 0) + 1;
            return acc;
        }, {}),
        assignments: positions.map(p => ({
            name: p.full_name,
            role: p.position,
            unit: p.unit_name,
            type: p.unit_type,
            is_placeholder: p.person_placeholder
        })),
        units: units.map(u => ({
            name: u.name,
            type: u.unit_type,
            parent: u.parent_id // roughly checking structure
        }))
    };

    fs.writeFileSync('db_dump.json', JSON.stringify(output, null, 2));
    console.log('Dump saved to db_dump.json');
}

dumpData();
