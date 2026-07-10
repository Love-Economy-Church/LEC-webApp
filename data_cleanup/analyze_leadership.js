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

    // 1. Build Parent-Child Map
    const childCounts = {}; // ID -> Count of children
    const parentMap = {};   // ID -> ParentID

    records.forEach(r => {
        parentMap[r.id] = r.parent_id;
        if (r.parent_id) {
            childCounts[r.parent_id] = (childCounts[r.parent_id] || 0) + 1;
        }
    });

    // 2. Identify Conflict Groups (Same Role)
    const roleGroups = {};
    records.forEach(r => {
        if (!r.role) return;
        // Ignore generic/member roles
        if (r.role.includes('Member') || r.role === 'Cell' || r.role === 'MC') return;

        if (!roleGroups[r.role]) roleGroups[r.role] = [];
        roleGroups[r.role].push(r);
    });

    console.log('--- Leadership Inference Analysis ---');
    let outputLog = '--- Leadership Inference Analysis ---\n';
    const log = (msg) => { console.log(msg); outputLog += msg + '\n'; };

    for (const [role, candidates] of Object.entries(roleGroups)) {
        if (candidates.length <= 1) continue;

        // Filter out "Pending Identity" to focus on real people conflicts
        const realCandidates = candidates.filter(c => c.full_name !== 'Pending Identity');

        if (realCandidates.length <= 1) continue; // Only care if 2+ real people share a role

        log(`\nConflict: "${role}"`);

        const scoredCandidates = realCandidates.map(c => {
            const score = childCounts[c.id] || 0;
            // Check if this candidate is a parent of any OTHER candidate in this group
            const isParentOfPeer = realCandidates.some(peer => peer.id !== c.id && peer.parent_id === c.id);
            return { ...c, score, isParentOfPeer };
        }).sort((a, b) => {
            if (a.isParentOfPeer && !b.isParentOfPeer) return -1;
            if (b.isParentOfPeer && !a.isParentOfPeer) return 1;
            return b.score - a.score;
        });

        scoredCandidates.forEach(c => {
            const flags = [];
            if (c.isParentOfPeer) flags.push('PARENT OF PEER');
            if (c.score > 0) flags.push(`${c.score} Direct Reports`);

            log(`  - [${c.score} reports] ${c.full_name} ${flags.length ? '(' + flags.join(', ') + ')' : ''}`);
        });

        // Inference
        const winner = scoredCandidates[0];
        const runnerUp = scoredCandidates[1];

        if (winner.score > runnerUp.score || winner.isParentOfPeer) {
            log(`  => PROBABLE LEADER: ${winner.full_name}`);
        } else {
            log(`  => UNCERTAIN: Equal or low scores.`);
        }
    }

    fs.writeFileSync('leadership_report.txt', outputLog, 'utf-8');
    console.log('Report written to leadership_report.txt');

} catch (err) {
    console.error(err);
}
