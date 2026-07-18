import { supabase } from '../lib/supabase';
import { cacheService, CACHE_KEYS } from './cacheService';

export const fetchHierarchyData = async () => {
    try {
        // Check Cache
        const cached = cacheService.get(CACHE_KEYS.HIERARCHY);
        if (cached) return cached;

        // 1. Fetch all organizational units (The Skeleton)
        const { data: units, error: unitsError } = await supabase
            .from('organizational_units')
            .select('id, parent_id, name, unit_type, order_index, is_placeholder')
            .order('order_index', { ascending: true }); // Respect the defined order

        if (unitsError) throw unitsError;

        // 2. Fetch all active assignments (The Flesh)
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
                    is_placeholder,
                    created_at,
                    attendance_records ( status )
                ),
                positions (title, level, unit_type)
            `)
            .eq('is_active', true);

        if (assignError) throw assignError;

        const unitsWithPeople = units.map(unit => {
            const unitAssignments = assignments.filter(a => a.unit_id === unit.id);

            // Separate Leaders from Members for UI convenience
            // though the mindmap might just want a flat list of people nodes.
            // Level < 100 is usually a leader/shepherd. 
            // Level 100+ or null is usually a member.
            
            const leaders = [];
            const members = [];

            unitAssignments.forEach(a => {
                const p = a.people;
                if (!p) return;

                // Hide System Admin from showing up in hierarchy tree/list
                if (a.positions?.title === 'Admin') {
                    return;
                }

                // Dynamically calculate membership state strictly to apply pipeline to basic members
                let presentCount = 0;
                if (p.attendance_records && p.attendance_records.length > 0) {
                    presentCount = p.attendance_records.filter(r => r.status === 'PRESENT').length;
                }

                const roleTitle = a.positions?.title || 'Unassigned';
                let membership_state = roleTitle;

                // Pipeline ONLY applies to people registered as 'First Timer' (added from attendance screen).
                // Anyone added via the directory with 'Cell Member', 'Member', or 'Unassigned' is already a
                // member and must always appear as 'Member', regardless of how many times they've attended.
                if (roleTitle === 'First Timer') {
                    if (presentCount === 1) membership_state = 'First Timer';
                    else if (presentCount === 2 || presentCount === 3) membership_state = 'Brethren';
                    else if (presentCount >= 4) membership_state = 'Member';
                    else membership_state = 'Unattended';
                } else if (roleTitle === 'Cell Member' || roleTitle === 'Member' || roleTitle === 'Unassigned') {
                    membership_state = 'Member';
                }

                // Hide staging members/first timers from the hierarchy tree
                if (membership_state === 'First Timer' || membership_state === 'Unattended') {
                    return;
                }

                const person = {
                    id: p.id,
                    name: p.full_name || 'Unknown',
                    role: roleTitle,
                    photo: p.photo_url,
                    isPlaceholder: p.is_placeholder,
                    level: a.positions?.level
                };

                // Level < 6 is a leader. 6+ or missing level is a member.
                if (a.positions?.level !== undefined && a.positions?.level !== null && a.positions.level < 6) {
                    leaders.push(person);
                } else {
                    members.push(person);
                }
            });

            // Sort leaders by level
            leaders.sort((a, b) => (a.level || 0) - (b.level || 0));

            return {
                ...unit,
                leaders,
                members,
                rawAssignmentCount: unitAssignments.length
            };
        });

        cacheService.set(CACHE_KEYS.HIERARCHY, unitsWithPeople);

        return unitsWithPeople;
    } catch (error) {
        console.error('Error fetching hierarchy:', error);
        throw error;
    }
};
// --- MUTATIONS ---

export const createUnit = async (unitData) => {
    // unitData: { name, unit_type, parent_id, order_index }
    const { data, error } = await supabase
        .from('organizational_units')
        .insert([unitData])
        .select()
        .single();

    if (error) throw error;
    // Invalidate Cache
    cacheService.remove(CACHE_KEYS.HIERARCHY);
    return data;
};

export const updateUnit = async (id, updates) => {
    const { data, error } = await supabase
        .from('organizational_units')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    // Invalidate Cache
    cacheService.remove(CACHE_KEYS.HIERARCHY);
    return data;
};

export const deleteUnit = async (id) => {
    const { error } = await supabase
        .from('organizational_units')
        .delete()
        .eq('id', id);

    if (error) throw error;
    // Invalidate Cache
    cacheService.remove(CACHE_KEYS.HIERARCHY);
    return true;
};

export const fetchPositions = async () => {
    // Check Cache
    const cached = cacheService.get(CACHE_KEYS.POSITIONS);
    if (cached) return cached;

    const { data, error } = await supabase
        .from('positions')
        .select('id, title, unit_type, level')
        .order('level', { ascending: true });

    if (error) throw error;
    cacheService.set(CACHE_KEYS.POSITIONS, data);
    return data;
};
