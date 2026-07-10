import { supabase } from '../lib/supabase';

// High-level rank matrix for quick comparison
const ROLE_RANKS = {
    'ADMIN': 120,
    'BRANCH': 100,
    'CHURCH': 80,
    'MC': 60,
    'BUSCENTA': 40,
    'CELL': 20
};

/**
 * Checks if the current user has permission to manage (edit/add/delete) 
 * data within the target unit.
 * 
 * @param {Object} currentRole - The user's role object from AuthContext
 * @param {string} targetUnitId - The ID of the unit they are trying to manage
 * @returns {Promise<boolean>} True if permitted, false otherwise
 */
export async function canManageUnit(currentRole, targetUnitId) {
    if (!currentRole) return false;
    
    // Admins can manage everything
    if (currentRole.unitType === 'ADMIN' || currentRole.title === 'Admin') return true;

    // Users can always manage their own direct unit (e.g., Cell Shepherd editing their own Cell)
    if (currentRole.unitId === targetUnitId) return true;

    // If it's not their own unit, they can only manage it if:
    // 1. They are above a Cell Shepherd AND
    // 2. The target unit is a descendant of their own unit
    if (ROLE_RANKS[currentRole.unitType] <= ROLE_RANKS['CELL']) {
        return false; // Cell Shepherds can never manage units other than their own
    }

    try {
        // Query the DB using our recursive CTE RPC function
        const { data: isDescendant, error } = await supabase
            .rpc('check_unit_descendant', {
                 parent_id: currentRole.unitId,
                 child_id: targetUnitId
            });

        if (error) {
             console.error("Permission RPC error:", error);
             return false;
        }

        return !!isDescendant;
    } catch (err) {
        console.error("Permission check failed:", err);
        return false;
    }
}

/**
 * Gets a pre-calculated Set of all unit IDs the user is allowed to manage.
 * This is used to avoid N+1 sequential permission checks across large lists.
 * 
 * @param {Object} currentRole - The user's role object
 * @returns {Promise<Set<string> | 'ALL'>} A Set of unit UUIDs, or the string 'ALL' for Admins
 */
export async function getManagedUnitIds(currentRole) {
    if (!currentRole) return new Set();
    
    // Admins manage all 
    if (currentRole.unitType === 'ADMIN' || currentRole.title === 'Admin') return 'ALL';

    try {
        const { data, error } = await supabase
            .rpc('get_managed_units', { root_parent_id: currentRole.unitId });

        if (error) {
             console.error("Batch permission RPC error:", error);
             return new Set();
        }

        // Handle variations in how Supabase postgres returns SETOF depending on PostgREST version
        const ids = (data || []).map(row => typeof row === 'object' ? (row.id || row.get_managed_units || Object.values(row)[0]) : row);
        return new Set(ids);
    } catch (err) {
        console.error("Batch permission check failed:", err);
        return new Set();
    }
}
