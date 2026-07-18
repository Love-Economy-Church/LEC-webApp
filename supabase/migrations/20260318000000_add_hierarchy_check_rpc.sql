-- Migration: Add function to verify descending hierarchy
-- Usage: SELECT check_unit_descendant(user_unit_id, target_unit_id)

CREATE OR REPLACE FUNCTION check_unit_descendant(parent_id UUID, child_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_descendant BOOLEAN;
BEGIN
    WITH RECURSIVE UnitHierarchy AS (
        -- Base case: The exact target child unit
        SELECT id, parent_id
        FROM organizational_units
        WHERE id = child_id
        
        UNION ALL
        
        -- Recursive case: traverse UP the tree
        SELECT ou.id, ou.parent_id
        FROM organizational_units ou
        INNER JOIN UnitHierarchy uh ON ou.id = uh.parent_id
    )
    -- Check if the parent_id we're looking for exists in the chain leading up from the child
    SELECT EXISTS (
        SELECT 1 FROM UnitHierarchy WHERE id = parent_id
    ) INTO is_descendant;

    RETURN is_descendant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
