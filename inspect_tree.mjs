import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://adtugmhftcjzswxtbyue.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM";

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Re-implement or import fetchHierarchyData and buildTree logic
export function buildTree(flatUnits) {
    if (!flatUnits || flatUnits.length === 0) return [];
    
    const map = {};
    const roots = [];

    // Initialize map
    flatUnits.forEach((unit) => {
        map[unit.id] = { ...unit, children: [] };
    });

    // Connect parents/children
    flatUnits.forEach((unit) => {
        if (unit.parent_id && map[unit.parent_id]) {
            map[unit.parent_id].children.push(map[unit.id]);
        } else {
            roots.push(map[unit.id]);
        }
    });

    const sortByName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    
    Object.values(map).forEach(node => {
        if (node.children && node.children.length > 0) {
            node.children.sort(sortByName);
        }
    });
    
    roots.sort(sortByName);

    return roots;
}

async function fetchHierarchyData() {
    // 1. Fetch all organizational units
    const { data: units, error: unitsError } = await supabase
        .from('organizational_units')
        .select('id, parent_id, name, unit_type, order_index, is_placeholder')
        .order('order_index', { ascending: true });

    if (unitsError) throw unitsError;

    // 2. Fetch all active assignments
    const { data: assignments, error: assignError } = await supabase
        .from('position_assignments')
        .select(`
            id,
            unit_id,
            is_primary,
            people (
                id, 
                full_name, 
                photo_url, 
                is_placeholder
            ),
            positions (title, level, unit_type)
        `)
        .eq('is_active', true);

    if (assignError) throw assignError;

    const unitsWithPeople = units.map(unit => {
        const unitAssignments = assignments.filter(a => a.unit_id === unit.id);
        const leaders = [];
        const members = [];

        unitAssignments.forEach(a => {
            const p = a.people;
            if (!p) return;

            const roleTitle = a.positions?.title || 'Unassigned';
            
            const person = {
                id: p.id,
                name: p.full_name || 'Unknown',
                role: roleTitle,
                photo: p.photo_url,
                isPlaceholder: p.is_placeholder,
                level: a.positions?.level
            };

            if (a.positions?.level !== undefined && a.positions?.level !== null && a.positions.level < 5) {
                leaders.push(person);
            } else {
                members.push(person);
            }
        });

        leaders.sort((a, b) => (a.level || 0) - (b.level || 0));

        return {
            ...unit,
            leaders,
            members
        };
    });

    return unitsWithPeople;
}

async function main() {
    const data = await fetchHierarchyData();
    const tree = buildTree(data);

    const dump = (node, indent = '') => {
        console.log(`${indent}${node.name} (${node.unit_type}) [Leaders: ${node.leaders.map(l => l.name).join(', ')}]`);
        (node.children || []).forEach(child => dump(child, indent + '  '));
    };

    tree.forEach(zone => dump(zone));
}

main();

