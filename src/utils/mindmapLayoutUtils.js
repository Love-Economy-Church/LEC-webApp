import { tree, hierarchy } from 'd3-hierarchy';
import { Position } from 'reactflow';

/* ─── Per-type accent colors ──────────────────────────────────────── */
export const TYPE_ACCENT = {
    ROOT:     '#94a3b8',
    BRANCH:   '#eab308',
    CHURCH:   '#8b5cf6',
    MC:       '#3b82f6',
    BUSCENTA: '#ec4899',
    CELL:     '#f97316',
    PERSON:   '#10b981',
};

// Node widths & heights used both for layout spacing AND for ReactFlow node sizing
export const NODE_DIMS = {
    PERSON: { width: 150, height: 80 },
    DEFAULT: { width: 220, height: 110 },
};

export const getStyle = (type, isSelected) => {
    const accent = TYPE_ACCENT[type] || '#3b82f6';
    const isPerson = type === 'PERSON';
    const dims = isPerson ? NODE_DIMS.PERSON : NODE_DIMS.DEFAULT;
    return {
        background: 'transparent',
        border: 'none',
        padding: 0,
        borderRadius: 0,
        width: dims.width,
        height: dims.height,
        ...(isSelected ? { filter: `drop-shadow(0 0 16px ${accent}bb)`, zIndex: 100 } : {}),
    };
};

/**
 * layoutTree — STABLE POSITIONS APPROACH
 *
 * Positions are computed from the FULL tree (ignoring collapsedIds).
 * Collapse/expand only toggles node `hidden` + edge `hidden` flags.
 * This means the canvas never shifts — collapsed children just disappear in place.
 */
export const layoutTree = (flatData, collapsedIds, userRole = null) => {
    if (!flatData || flatData.length === 0) return { nodes: [], edges: [] };

    const dataMap     = new Map(flatData.map(d => [d.id, { ...d }]));
    const roots       = flatData.filter(d => !d.parent_id || !dataMap.has(d.parent_id));
    const childrenMap = new Map();
    const parentMap   = new Map(); // child id → parent id

    flatData.forEach(d => {
        if (d.parent_id) {
            if (!childrenMap.has(d.parent_id)) childrenMap.set(d.parent_id, []);
            childrenMap.get(d.parent_id).push(d);
            parentMap.set(d.id, d.parent_id);
        }
    });

    /* ── Build FULL hierarchy (no collapsing) ─────────────────────── */
    const buildFull = (parentId) => {
        const unit     = dataMap.get(parentId);
        const unitKids = childrenMap.get(parentId) || [];
        const result   = { id: parentId, ...unit, children: unitKids.map(k => buildFull(k.id)) };
        if (result.children.length === 0) delete result.children;
        return result;
    };

    if (roots.length === 0) return { nodes: [], edges: [] };

    let hierarchyData;
    if (roots.length === 1) {
        hierarchyData = buildFull(roots[0].id);
    } else {
        hierarchyData = {
            id: 'synthetic-root',
            name: userRole ? `${userRole.unitName || 'My'} Jurisdiction` : 'Global Church Structure',
            unit_type: 'ROOT',
            children: roots.map(r => buildFull(r.id)),
        };
        dataMap.set('synthetic-root', { id: 'synthetic-root', name: hierarchyData.name, unit_type: 'ROOT' });
    }

    /* ── Compute positions from full tree (fixed, never changes) ───── */
    const root = hierarchy(hierarchyData);
    const treeLayout = tree()
        .nodeSize([130, 320])
        .separation((a, b) => (a.parent === b.parent ? 1.2 : 1.5));
    treeLayout(root);

    /* ── Determine which nodes/edges should be hidden ─────────────── */
    const isHiddenByCollapse = (nodeId) => {
        let cursor = parentMap.get(nodeId);
        while (cursor !== undefined) {
            if (collapsedIds.has(cursor)) return true;
            cursor = parentMap.get(cursor);
        }
        return false;
    };

    const nodes = [];
    const edges = [];

    root.descendants().forEach(d => {
        const isCollapsed = collapsedIds.has(d.data.id);
        const isHidden    = isHiddenByCollapse(d.data.id);
        const isPerson    = d.data.unit_type === 'PERSON';
        const dims        = isPerson ? NODE_DIMS.PERSON : NODE_DIMS.DEFAULT;

        nodes.push({
            id: d.data.id,
            type: 'mindMapNode',
            // ReactFlow uses (x,y) as the node's TOP-LEFT corner.
            // d3-hierarchy gives CENTER coordinates (.y = depth axis, .x = cross axis).
            position: { x: d.y - dims.width / 2, y: d.x - dims.height / 2 },
            // Explicit dimensions let ReactFlow do accurate fitView / minimap
            width:  dims.width,
            height: dims.height,
            hidden: isHidden,
            data: {
                label:    d.data.name,
                unit_type: d.data.unit_type,
                hasChildren: !!(childrenMap.get(d.data.id)?.length > 0),
                isCollapsed,
                leaders:  d.data.leaders,
                members:  d.data.members,
                photo:    d.data.photo,
                role:     d.data.role,
                id:       d.data.id,
                isOwnJurisdiction: userRole && d.data.id === userRole.unitId,
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            style: getStyle(d.data.unit_type, false),
        });

        if (d.parent) {
            const parentAccent = TYPE_ACCENT[d.parent.data.unit_type] || '#475569';
            const edgeHidden = isHidden || collapsedIds.has(d.parent.data.id);
            edges.push({
                id:     `e${d.parent.data.id}-${d.data.id}`,
                source: d.parent.data.id,
                target: d.data.id,
                type:   'smoothstep',
                hidden: edgeHidden,
                style: {
                    stroke: `${parentAccent}70`,
                    strokeWidth: 1.5,
                },
                animated: false,
            });
        }
    });

    return { nodes, edges };
};
