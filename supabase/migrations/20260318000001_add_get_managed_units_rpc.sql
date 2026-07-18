-- Migration: Add function to fetch all descending managed units at once
-- Usage: SELECT * FROM get_managed_units(user_unit_id)

CREATE OR REPLACE FUNCTION get_managed_units(root_parent_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE UnitHierarchy AS (
        -- Base case: The root parent unit itself
        SELECT id
        FROM organizational_units
        WHERE id = root_parent_id
        
        UNION ALL
        
        -- Recursive case: traverse DOWN the tree to get all children, grandchildren, etc.
        SELECT ou.id
        FROM organizational_units ou
        INNER JOIN UnitHierarchy uh ON ou.parent_id = uh.id
    )
    SELECT id FROM UnitHierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
