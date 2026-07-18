import { supabase } from '../lib/supabase';
import { cacheService, CACHE_KEYS } from './cacheService';

export async function fetchPeople() {
    // Check Cache
    const cached = cacheService.get(CACHE_KEYS.PEOPLE);
    if (cached) return cached;

    // We want: Name, Role, Unit Name, Unit Type, Status
    const { data, error } = await supabase
        .from('people')
        .select(`
            id,
            full_name,
            photo_url,
            is_active,
            is_placeholder,
            created_at,
            assignments:position_assignments(
                id,
                unit_id,
                position_id,
                is_active,
                position:positions(title, unit_type),
                unit:organizational_units(name, unit_type)
            ),
            attendance_records (
                status
            )
        `)
        .order('full_name');

    if (error) throw error;

    // Flatten logic
    const result = data.map(person => {
        // Get primary active assignment
        const primaryAssignment = person.assignments?.find(a => a.is_active);

            // Smart status derivation:
            // - Pending: members whose names indicate they are pending identity (contains 'pending'), 
            //            or placeholders that are NOT system unit placeholders (ending in ' - Leader')
            // - Inactive: person.is_active is false
            // - Active: real, active member
            
            const isSystemUnitPlaceholder = person.is_placeholder && person.full_name.includes(' - Leader');
            const hasPendingName = person.full_name.toLowerCase().includes('pending');
            
            let status;
            if (!person.is_active && !isSystemUnitPlaceholder) {
                status = 'Inactive';
            } else if (person.is_placeholder && !isSystemUnitPlaceholder) {
                status = 'Pending';
            } else if (isSystemUnitPlaceholder) {
                status = 'System'; 
            } else {
                status = 'Active';
            }

            // Calculate Membership State purely through attendance
            let presentCount = 0;
            if (person.attendance_records && person.attendance_records.length > 0) {
                presentCount = person.attendance_records.filter(r => r.status === 'PRESENT').length;
            }

            const roleTitle = primaryAssignment?.position?.title || 'Unassigned';
            let membership_state = roleTitle; // Default to their exact leadership role
            
            // Pipeline ONLY applies to people registered as 'First Timer' (added from the attendance screen).
            // Anyone added via the directory with role 'Cell Member', 'Member', or 'Unassigned'
            // is already a member and should always appear as 'Member'.
            if (roleTitle === 'First Timer') {
                if (presentCount <= 1) membership_state = 'First Timer';
                else if (presentCount === 2 || presentCount === 3) membership_state = 'Brethren';
                else if (presentCount >= 4) membership_state = 'Member';
            } else if (roleTitle === 'Cell Member' || roleTitle === 'Member' || roleTitle === 'Unassigned') {
                membership_state = 'Member';
            }

            return {
                id: person.id,
                name: person.full_name,
                photo: person.photo_url,
                role: primaryAssignment?.position?.title || 'Unassigned',
                unit: primaryAssignment?.unit?.name || 'Unassigned',
                unit_id: primaryAssignment?.unit_id,
                position_id: primaryAssignment?.position_id,
                assignment_id: primaryAssignment?.id,
                unit_type: primaryAssignment?.unit?.unit_type,
                status,
                membership_state,
                present_count: presentCount,
                is_placeholder: person.is_placeholder
            };
    });

    cacheService.set(CACHE_KEYS.PEOPLE, result);
    return result;
}

// --- MUTATIONS ---
export const createFirstTimer = async (personData) => {
    // 1. Create Person directly (No Auth Login needed for guests)
    const { data: person, error } = await supabase
        .from('people')
        .insert([{
            full_name: personData.fullName,
            personal_email: personData.personalEmail || null,
            is_placeholder: false
        }])
        .select()
        .single();

    if (error) throw error;

    // 2. Create Assignment (if unit/position provided)
    if (personData.unitId && personData.positionId) {
        const { error: assignError } = await supabase
            .from('position_assignments')
            .insert([{
                person_id: person.id,
                unit_id: personData.unitId,
                position_id: personData.positionId,
                is_active: true,
                is_primary: true
            }]);

        if (assignError) {
            console.error("Failed to assign person:", assignError);
        }
    }

    cacheService.remove(CACHE_KEYS.PEOPLE);
    cacheService.remove(CACHE_KEYS.HIERARCHY);

    return { person };
};

export const createPerson = async (personData) => {
    // Trim and normalize the input name
    const trimmedName = (personData.fullName || '').trim();
    if (!trimmedName) throw new Error("Full name is required");

    // Generate the default church email using same logic as the Edge Function
    const names = trimmedName.split(/\s+/);
    const firstName = names[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "member";
    const lastName = names.length > 1 ? names[names.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "") : "member";
    
    let domain = 'churchone.com';
    if (personData.unitId) {
        let currentId = personData.unitId;
        for (let i = 0; i < 5; i++) {
            const { data: unit } = await supabase
                .from('organizational_units')
                .select('id, name, unit_type, parent_id')
                .eq('id', currentId)
                .maybeSingle();
            if (!unit) break;
            if (unit.unit_type === 'BRANCH') {
                // Derive domain from first word of branch name: "Alpha Branch" → "alpha.com"
                const firstWord = unit.name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
                domain = `${firstWord}.com`;
                break;
            }
            if (unit.unit_type === 'CHURCH') {
                const cleanName = unit.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                domain = `${cleanName}.com`;
                break;
            }
            if (!unit.parent_id) break;
            currentId = unit.parent_id;
        }
    }
    const generatedEmail = `${firstName}.${lastName}@${domain}`;

    // Query DB in parallel by name, generated email, and personal email (if provided)
    const queries = [
        supabase.from('people').select('*').ilike('full_name', trimmedName).limit(5),
        supabase.from('people').select('*').ilike('full_name', `%${trimmedName}%`).limit(5)
    ];

    if (generatedEmail) {
        queries.push(supabase.from('people').select('*').eq('email', generatedEmail).limit(5));
    }

    if (personData.personalEmail) {
        queries.push(supabase.from('people').select('*').eq('personal_email', personData.personalEmail.trim()).limit(5));
    }

    const queryResults = await Promise.all(queries);
    const existingMatches = [];
    const seenIds = new Set();

    for (const r of queryResults) {
        if (r.data) {
            for (const p of r.data) {
                if (!seenIds.has(p.id)) {
                    seenIds.add(p.id);
                    existingMatches.push(p);
                }
            }
        }
    }

    // Filter out system-generated leader placeholder slots in JS (name like "KB2 Zone - Leader")
    const realMatches = existingMatches.filter(p => !p.full_name?.endsWith(' - Leader'));

    // Try to find the best match: prefer one assigned to the same unit, or else the first one
    let existingPerson = null;
    if (realMatches.length > 0) {
        if (personData.unitId && realMatches.length > 1) {
            // Check which one has an assignment in the target unit
            for (const p of realMatches) {
                const { data: assignment } = await supabase
                    .from('position_assignments')
                    .select('id')
                    .eq('person_id', p.id)
                    .eq('unit_id', personData.unitId)
                    .limit(1)
                    .maybeSingle();
                if (assignment) { existingPerson = p; break; }
            }
        }
        // Fall back to the first match if no unit-specific match
        if (!existingPerson) existingPerson = realMatches[0];
    }

    if (existingPerson) {
        console.log("Reusing existing person record:", existingPerson.id, "| was active:", existingPerson.is_active);

        // 1. Ensure person is active
        const { data: reactivatedPerson, error: reactivateError } = await supabase
            .from('people')
            .update({
                is_active: true,
                is_placeholder: false,
                full_name: trimmedName, // Save it trimmed
                personal_email: personData.personalEmail || existingPerson.personal_email
            })
            .eq('id', existingPerson.id)
            .select()
            .single();

        if (reactivateError) throw reactivateError;

        // 2. Update placement: deactivate all old assignments, insert new one
        if (personData.unitId && personData.positionId) {
            await supabase
                .from('position_assignments')
                .update({ is_active: false })
                .eq('person_id', existingPerson.id);

            await supabase
                .from('position_assignments')
                .insert([{
                    person_id: existingPerson.id,
                    unit_id: personData.unitId,
                    position_id: personData.positionId,
                    is_active: true,
                    is_primary: true
                }]);
        }

        cacheService.remove(CACHE_KEYS.PEOPLE);
        cacheService.remove(CACHE_KEYS.HIERARCHY);

        return { person: reactivatedPerson, login: null };
    }


    // --- Brand new person: call Edge Function to create auth account ---
    const { data, error } = await supabase.functions.invoke('create-auth-user', {
        body: {
            fullName: personData.fullName,
            personalEmail: personData.personalEmail || null,
            unitId: personData.unitId,
            positionId: personData.positionId
        }
    });

    if (error) {
        // Try to extract the real error message from the Edge Function response body
        let realMessage = error.message;
        try {
            if (error.context) {
                const body = await error.context.json();
                if (body?.error) realMessage = body.error;
            }
        } catch (_) {}
        console.error("Edge function error:", realMessage, error);
        throw new Error(realMessage);
    }

    if (data?.error) {
        console.error("Edge function returned error:", data.error);
        throw new Error(data.error);
    }

    cacheService.remove(CACHE_KEYS.PEOPLE);
    cacheService.remove(CACHE_KEYS.HIERARCHY);

    if (data?.warning) {
        console.warn("Creation warning:", data.warning);
    }

    return { person: data.person, login: data.login };
};
export const updatePerson = async (id, updates) => {
    // 1. Update Core Bio
    const { data: person, error: personError } = await supabase
        .from('people')
        .update({
            full_name: updates.fullName,
            is_active: updates.is_active
        })
        .eq('id', id)
        .select()
        .single();

    if (personError) throw personError;
    // 2. Handle Assignment Update (Transfer)
    if (updates.unitId && updates.positionId) {
        // Find existing active assignment to see if anything actually changed
        const { data: existingActive } = await supabase
            .from('position_assignments')
            .select('id, unit_id, position_id')
            .eq('person_id', id)
            .eq('is_active', true)
            .maybeSingle();

        if (!existingActive || existingActive.unit_id !== updates.unitId || existingActive.position_id !== updates.positionId) {
            // Something has actually changed or they have no active assignment!
            // First check if an assignment with this person, unit, position, and start_date = today already exists
            const today = new Date().toISOString().split('T')[0];
            const { data: duplicate } = await supabase
                .from('position_assignments')
                .select('id')
                .eq('person_id', id)
                .eq('unit_id', updates.unitId)
                .eq('position_id', updates.positionId)
                .eq('start_date', today)
                .maybeSingle();

            if (duplicate) {
                // If it already exists for today (even if inactive), we can just reactivate it!
                // This prevents violating the unique(person_id, position_id, unit_id, start_date) constraint
                await supabase
                    .from('position_assignments')
                    .update({ is_active: false })
                    .eq('person_id', id);

                const { error: reactivateError } = await supabase
                    .from('position_assignments')
                    .update({ is_active: true, is_primary: true })
                    .eq('id', duplicate.id);

                if (reactivateError) throw reactivateError;
            } else {
                // Deactivate old assignments
                await supabase
                    .from('position_assignments')
                    .update({ is_active: false })
                    .eq('person_id', id);

                // Create new one
                const { error: assignError } = await supabase
                    .from('position_assignments')
                    .insert([{
                        person_id: id,
                        unit_id: updates.unitId,
                        position_id: updates.positionId,
                        is_active: true,
                        is_primary: true
                    }]);

                if (assignError) throw assignError;
            }
        }
    }

    // Invalidate People + Hierarchy caches
    cacheService.remove(CACHE_KEYS.PEOPLE);
    cacheService.remove(CACHE_KEYS.HIERARCHY);

    return person;
};

export const deactivatePerson = async (id) => {
    const { error } = await supabase
        .from('people')
        .update({ is_active: false })
        .eq('id', id);

    if (error) throw error;
    cacheService.remove(CACHE_KEYS.PEOPLE);
    cacheService.remove(CACHE_KEYS.HIERARCHY);
    return true;
};

export const reactivatePerson = async (id) => {
    const { error } = await supabase
        .from('people')
        .update({ is_active: true, is_placeholder: false })
        .eq('id', id);

    if (error) throw error;
    cacheService.remove(CACHE_KEYS.PEOPLE);
    cacheService.remove(CACHE_KEYS.HIERARCHY);
    return true;
};

export const setPendingPerson = async (id) => {
    const { error } = await supabase
        .from('people')
        .update({ is_active: true, is_placeholder: true })
        .eq('id', id);

    if (error) throw error;
    cacheService.remove(CACHE_KEYS.PEOPLE);
    cacheService.remove(CACHE_KEYS.HIERARCHY);
    return true;
};

// Hard delete - reserved for admin cleanup only (not exposed in UI)
export const hardDeletePerson = async (id) => {
    const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', id);

    if (error) throw error;
    cacheService.remove(CACHE_KEYS.PEOPLE);
    return true;
};
