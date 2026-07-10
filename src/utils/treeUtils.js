/**
 * Converts a flat list of organizational units into a nested tree structure.
 * @param {Array} flatUnits - Array of unit objects with id and parent_id.
 * @returns {Array} Array of root nodes with children.
 */
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

    // Sort by order_index first (if available), then fallback to natural name sort
    const sortByOrderOrName = (a, b) => {
        // Use order_index if both are defined and not null
        if (a.order_index != null && b.order_index != null) {
            if (a.order_index !== b.order_index) {
                return a.order_index - b.order_index;
            }
        }
        // Fallback to natural sort for units without explicit ordering (e.g. Cell 1, Cell 2)
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    };
    
    Object.values(map).forEach(node => {
        if (node.children && node.children.length > 0) {
            node.children.sort(sortByOrderOrName);
        }
    });
    
    roots.sort(sortByOrderOrName);

    return roots;
}

/**
 * Recursively filters a tree of nodes based on a search term.
 * @param {Array} nodes - Tree of nodes.
 * @param {string} term - Search term.
 * @returns {Array} Filtered tree.
 */
export const filterNodes = (nodes, term) => {
    if (!term) return nodes;

    return nodes.reduce((acc, node) => {
        const matchesSelf = 
            node.name.toLowerCase().includes(term.toLowerCase()) ||
            node.leaders?.some(l => l.name.toLowerCase().includes(term.toLowerCase())) ||
            node.members?.some(m => m.name.toLowerCase().includes(term.toLowerCase()));

        const filteredChildren = filterNodes(node.children || [], term);

        if (matchesSelf || filteredChildren.length > 0) {
            acc.push({
                ...node,
                children: filteredChildren,
            });
        }
        return acc;
    }, []);
};

/**
 * Flattens a tree back into a list (useful for some search cases)
 */
export const flattenTree = (nodes, result = []) => {
    nodes.forEach(node => {
        result.push(node);
        if (node.children) flattenTree(node.children, result);
    });
    return result;
};
