import { tree, hierarchy } from 'd3-hierarchy';
import { Position } from 'reactflow';

export const baseStyle = {
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: '#f8fafc',
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderStyle: 'solid',
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '700',
    width: '200px',
    minHeight: '72px',
    boxSizing: 'border-box',
    textAlign: 'center',
    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
};

export const getStyle = (type, isSelected, role) => {
    let style = { ...baseStyle };
    if (isSelected) {
        style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.35), 0 8px 32px -4px rgba(0, 0, 0, 0.6)';
        style.borderTopColor = 'rgba(59, 130, 246, 0.4)';
        style.borderRightColor = 'rgba(59, 130, 246, 0.4)';
        style.borderBottomColor = 'rgba(59, 130, 246, 0.4)';
        style.borderLeftColor = 'rgba(59, 130, 246, 0.4)';
        style.transform = 'scale(1.03)';
        style.zIndex = 100;
    }


    switch (type) {
        case 'BRANCH': return {
            ...style,
            borderLeftColor: '#eab308',
            borderLeftWidth: '4px',
            background: isSelected ? 'rgba(234, 179, 8, 0.15)' : style.background
        };
        case 'CHURCH': return {
            ...style,
            borderLeftColor: '#8b5cf6',
            borderLeftWidth: '4px',
            background: isSelected ? 'rgba(139, 92, 246, 0.15)' : style.background
        };
        case 'MC': return {
            ...style,
            borderLeftColor: '#3b82f6',
            borderLeftWidth: '4px',
            background: isSelected ? 'rgba(59, 130, 246, 0.15)' : style.background
        };
        case 'BUSCENTA': return {
            ...style,
            borderLeftColor: '#ec4899',
            borderLeftWidth: '4px',
            background: isSelected ? 'rgba(236, 72, 153, 0.15)' : style.background
        };
        case 'CELL': return {
            ...style,
            borderLeftColor: '#f97316',
            borderLeftWidth: '4px',
            background: isSelected ? 'rgba(249, 115, 22, 0.15)' : style.background
        };
        case 'PERSON': {
            const roleLower = role?.toLowerCase() || '';
            const isCellShepherd = roleLower.includes('cell shepherd');
            const isShepherd = roleLower === 'shepherd';
            if (isCellShepherd) {
                return {
                    ...style,
                    borderLeftColor: '#f59e0b', // Amber/Gold for Cell Shepherd
                    borderLeftWidth: '4px',
                    background: isSelected ? 'rgba(245, 158, 11, 0.15)' : style.background
                };
            } else if (isShepherd) {
                return {
                    ...style,
                    borderLeftColor: '#8b5cf6', // Violet/Purple for Shepherd
                    borderLeftWidth: '4px',
                    background: isSelected ? 'rgba(139, 92, 246, 0.15)' : style.background
                };
            } else {
                return {
                    ...style,
                    borderLeftColor: '#10b981', // Emerald for Member
                    borderLeftWidth: '4px',
                    background: isSelected ? 'rgba(16, 185, 129, 0.15)' : style.background
                };
            }
        }
        default: return style;
    };
};

export const layoutTree = (flatData, collapsedIds, userRole = null) => {
    if (!flatData || flatData.length === 0) return { nodes: [], edges: [] };

    const dataMap = new Map(flatData.map(d => [d.id, { ...d }]));
    const roots = flatData.filter(d => !d.parent_id || !dataMap.has(d.parent_id));

    const childrenMap = new Map();
    flatData.forEach(d => {
        if (d.parent_id) {
            if (!childrenMap.has(d.parent_id)) childrenMap.set(d.parent_id, []);
            childrenMap.get(d.parent_id).push(d);
        }
    });

    const nodes = [];
    const edges = [];

    const buildHierarchy = (parentId) => {
        const unit = dataMap.get(parentId);
        const unitKids = childrenMap.get(parentId) || [];

        const children = collapsedIds.has(parentId)
            ? []
            : unitKids.map(k => buildHierarchy(k.id));

        const result = {
            id: parentId,
            ...unit,
            children
        };

        if (result.children.length === 0) delete result.children;
        return result;
    }

    if (roots.length === 0) return { nodes: [], edges: [] };

    let hierarchyData;
    if (roots.length === 1) {
        hierarchyData = buildHierarchy(roots[0].id);
    } else {
        hierarchyData = {
            id: 'synthetic-root',
            name: userRole ? `${userRole.unitName || 'My'} Jurisdiction` : 'Global Church Structure',
            unit_type: 'ROOT',
            children: roots.map(r => buildHierarchy(r.id))
        };
        dataMap.set('synthetic-root', { id: 'synthetic-root', name: hierarchyData.name, unit_type: 'ROOT' });
    }

    const root = hierarchy(hierarchyData);

    // Tightened horizontal sibling layout from 120->80 and vertical depth layout from 420->260
    const treeLayout = tree()
        .nodeSize([80, 260])
        .separation((a, b) => (a.parent === b.parent ? 1.1 : 1.3));

    treeLayout(root);

    root.descendants().forEach(d => {
        nodes.push({
            id: d.data.id,
            type: 'mindMapNode',
            position: { x: d.y, y: d.x },
            data: {
                label: d.data.name,
                unit_type: d.data.unit_type,
                hasChildren: (childrenMap.get(d.data.id)?.length || 0) > 0,
                isCollapsed: collapsedIds.has(d.data.id),
                leaders: d.data.leaders,
                members: d.data.members,
                photo: d.data.photo,
                role: d.data.role,
                unitName: d.data.unitName,
                isPlaceholder: d.data.isPlaceholder,
                id: d.data.id,
                isOwnJurisdiction: userRole && d.data.id === userRole.unitId
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            style: getStyle(d.data.unit_type, false, d.data.role)
        });

        if (d.parent) {
            edges.push({
                id: `e${d.parent.data.id}-${d.data.id}`,
                source: d.parent.data.id,
                target: d.data.id,
                type: 'default',
                style: { stroke: '#475569', strokeWidth: 1.5 },
                animated: false
            });
        }
    });

    return { nodes, edges };
};
