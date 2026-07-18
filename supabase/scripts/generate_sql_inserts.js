import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const csvPath = path.join(process.cwd(), '../people_rows (1).csv');

try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    });

    let sql = `CREATE TABLE raw_people_data (
    id UUID PRIMARY KEY,
    full_name VARCHAR,
    role TEXT,
    parent_id UUID,        -- Added this column
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN,
    is_placeholder BOOLEAN,
    original_role TEXT
);\n\n`;

    sql += `INSERT INTO raw_people_data (id, full_name, parent_id, photo_url, created_at, active, is_placeholder, original_role) VALUES\n`;

    const values = records.map(r => {
        const parentId = r.parent_id ? `'${r.parent_id}'` : 'NULL';
        const photoUrl = r.photo_url ? `'${r.photo_url}'` : 'NULL';
        const role = r.role ? `'${r.role.replace(/'/g, "''")}'` : 'NULL'; // Escape single quotes
        return `('${r.id}', '${r.full_name.replace(/'/g, "''")}', ${parentId}, ${photoUrl}, '${r.created_at}', ${r.active}, ${r.is_placeholder}, ${role})`;
    });

    sql += values.join(',\n') + ';\n';

    fs.writeFileSync('generated_inserts.sql', sql);
    console.log('Generated SQL saved to generated_inserts.sql');

} catch (err) {
    console.error(err);
}
