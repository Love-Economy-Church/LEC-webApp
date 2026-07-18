import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchHierarchyData, createUnit } from '../services/hierarchyService';
import { cacheService } from '../services/cacheService';
import AddUnitModal from '../components/AddUnitModal';
import ImageModal from '../components/common/ImageModal';
import PersonProfileModal from '../components/PersonProfileModal';
import { Search } from 'lucide-react';

/* ─── Layout constants ───────────────────────────────────────── */
const NODE_W  = 200;
const NODE_H  = 90;
const COL_GAP = 72;
const ROW_GAP = 16;

/* ─── Type styling ───────────────────────────────────────────── */
const TYPE_COLOR = {
    BRANCH:   '#eab308',
    CHURCH:   '#8b5cf6',
    MC:       '#3b82f6',
    BUSCENTA: '#ec4899',
    CELL:     '#f97316',
    PERSON:   '#10b981',
};
const TYPE_ICON = {
    BRANCH:'🏛', CHURCH:'⛪', MC:'🧩', BUSCENTA:'🌐', CELL:'🔵', PERSON:'👤',
};

/* ─── Build tree from flat array ─────────────────────────────── */
function buildTree(flat) {
    const map = {};
    flat.forEach(d => { map[d.id] = { ...d, children: [] }; });
    const roots = [];
    flat.forEach(d => {
        if (d.parent_id && map[d.parent_id]) map[d.parent_id].children.push(map[d.id]);
        else roots.push(map[d.id]);
    });
    return roots;
}

/* ─── Recursive layout ───────────────────────────────────────── */
function layoutNode(node, depth, collapsed, yStart) {
    node.x = depth * (NODE_W + COL_GAP);
    const isCollapsed = collapsed.has(node.id);
    const visChildren = !isCollapsed ? (node.children || []) : [];

    if (visChildren.length === 0) {
        node.y = yStart;
        node.subtreeH = NODE_H;
        return yStart + NODE_H;
    }

    let cursor = yStart;
    visChildren.forEach(child => {
        cursor = layoutNode(child, depth + 1, collapsed, cursor);
        cursor += ROW_GAP;
    });
    cursor -= ROW_GAP;

    const subtreeH = cursor - yStart;
    node.y = yStart + (subtreeH - NODE_H) / 2;
    node.subtreeH = subtreeH;
    return cursor;
}

function flattenTree(node, collapsed, acc = []) {
    acc.push(node);
    if (!collapsed.has(node.id)) (node.children || []).forEach(c => flattenTree(c, collapsed, acc));
    return acc;
}

function collectEdges(node, collapsed, acc = []) {
    if (!collapsed.has(node.id)) {
        (node.children || []).forEach(child => {
            acc.push({ parent: node, child });
            collectEdges(child, collapsed, acc);
        });
    }
    return acc;
}

/* ─── SVG node card ─────────────────────────────────────────── */
function NodeCard({ node, collapsed, onToggle, onSelect, selectedId }) {
    const color      = TYPE_COLOR[node.unit_type] || '#94a3b8';
    const isSelected = selectedId === node.id;
    const hasKids    = (node.children || []).length > 0;
    const isCollapsed = collapsed.has(node.id);
    const leader     = node.leaders?.[0];

    return (
        <g
            transform={`translate(${node.x},${node.y})`}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect(node.id === selectedId ? null : node.id)}
        >
            {/* Glow halo when selected */}
            {isSelected && (
                <rect x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6}
                      rx={15} fill={color} opacity={0.18} filter="url(#halo)" />
            )}
            {/* Card bg */}
            <rect width={NODE_W} height={NODE_H} rx={12}
                  fill="rgba(10,15,28,0.88)"
                  stroke={isSelected ? color : 'rgba(255,255,255,0.07)'}
                  strokeWidth={isSelected ? 1.5 : 1} />
            {/* Left accent strip */}
            <rect width={3} height={NODE_H} rx={2} fill={color} />

            {/* Type badge row */}
            <foreignObject x={10} y={10} width={NODE_W - 20} height={18}>
                <div xmlns="http://www.w3.org/1999/xhtml"
                     style={{ display:'flex', alignItems:'center', gap:4, fontFamily:'inherit' }}>
                    <span style={{ fontSize:10 }}>{TYPE_ICON[node.unit_type]}</span>
                    <span style={{
                        fontSize:7.5, fontWeight:900, letterSpacing:'0.14em',
                        textTransform:'uppercase', color,
                        background:`${color}18`, border:`1px solid ${color}30`,
                        borderRadius:4, padding:'1px 5px',
                    }}>{node.unit_type}</span>
                </div>
            </foreignObject>

            {/* Unit name */}
            <foreignObject x={10} y={28} width={NODE_W - 26} height={34}>
                <div xmlns="http://www.w3.org/1999/xhtml"
                     style={{
                         fontSize:12, fontWeight:700, color:'#f1f5f9',
                         lineHeight:1.35, fontFamily:'inherit',
                         overflow:'hidden', display:'-webkit-box',
                         WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                     }}>
                    {node.name}
                </div>
            </foreignObject>

            {/* Leader row */}
            {leader && (
                <foreignObject x={10} y={65} width={NODE_W - 26} height={20}>
                    <div xmlns="http://www.w3.org/1999/xhtml"
                         style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'inherit' }}>
                        <div style={{
                            width:16, height:16, borderRadius:'50%',
                            background:'#1e293b', border:`1px solid ${color}44`,
                            overflow:'hidden', flexShrink:0,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:9, color:'#94a3b8',
                        }}>
                            {leader.photo
                                ? <img src={leader.photo} alt={leader.name}
                                       style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                : leader.name?.charAt(0)}
                        </div>
                        <span style={{
                            fontSize:9.5, color:'#94a3b8',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                            flex:1,
                        }}>{leader.name}</span>
                    </div>
                </foreignObject>
            )}

            {/* Expand/collapse toggle */}
            {hasKids && (
                <g transform={`translate(${NODE_W - 12},${NODE_H / 2 - 10})`}
                   onClick={e => { e.stopPropagation(); onToggle(node.id); }}>
                    <circle cx={10} cy={10} r={10}
                            fill="#0a0f1c" stroke={color} strokeWidth={1.5}
                            style={{ cursor:'pointer' }} />
                    <text x={10} y={14.5} textAnchor="middle"
                          fill={color} fontSize={13} fontWeight={900}
                          style={{ userSelect:'none', fontFamily:'sans-serif' }}>
                        {isCollapsed ? '+' : '−'}
                    </text>
                </g>
            )}
        </g>
    );
}

/* ─── Bezier edge ────────────────────────────────────────────── */
function Edge({ parent, child }) {
    const color = TYPE_COLOR[parent.unit_type] || '#475569';
    const x1 = parent.x + NODE_W;
    const y1 = parent.y + NODE_H / 2;
    const x2 = child.x;
    const y2 = child.y + NODE_H / 2;
    const mx = (x1 + x2) / 2;
    return (
        <path
            d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke={`${color}50`}
            strokeWidth={1.5}
        />
    );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function HierarchyMindMapPage() {
    const { user, userRole, getManagedUnits } = useAuth();

    const [flatData,        setFlatData]        = useState([]);
    const [collapsed,       setCollapsed]       = useState(new Set());
    const [selectedId,      setSelectedId]      = useState(null);
    const [searchTerm,      setSearchTerm]      = useState('');
    const [loading,         setLoading]         = useState(true);
    const [zoom,            setZoom]            = useState(1);
    const [pan,             setPan]             = useState({ x: 40, y: 40 });
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [targetParent,    setTargetParent]    = useState(null);
    const [imgModal,        setImgModal]        = useState({ open: false, src: '', title: '' });
    const [personModal,     setPersonModal]     = useState(null);

    const svgRef    = useRef(null);
    const dragging  = useRef(false);
    const lastPos   = useRef({ x: 0, y: 0 });

    /* ── Load hierarchy data ── */
    const refreshData = useCallback(async () => {
        setLoading(true);
        cacheService.clear();

        let allowed = new Set(), allManaged = false;
        if (userRole) {
            try {
                const r = await getManagedUnits();
                if (r === 'ALL') allManaged = true; else allowed = r;
            } catch (e) { console.error(e); }
        }

        try {
            const units = await fetchHierarchyData();
            let filtered = units;
            if (user && !allManaged) filtered = units.filter(u => allowed.has(u.id));
            setFlatData(filtered);

            const initCollapsed = new Set();
            filtered.forEach(u => {
                if (['MC','BUSCENTA','CELL'].includes(u.unit_type)) initCollapsed.add(u.id);
            });
            setCollapsed(initCollapsed);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [user, userRole, getManagedUnits]);

    useEffect(() => { refreshData(); }, [refreshData]);

    const toggle = useCallback(id => {
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    /* ── Build layout ── */
    const { allNodes, allEdges, svgW, svgH, rootNode } = useMemo(() => {
        if (flatData.length === 0) return { allNodes: [], allEdges: [], svgW: 0, svgH: 0, rootNode: null };

        const roots = buildTree(flatData);
        const lower = searchTerm.toLowerCase();
        const matchIds = lower
            ? new Set(flatData.filter(d => d.name?.toLowerCase().includes(lower)).map(d => d.id))
            : null;

        let cursor = 0;
        roots.forEach(root => {
            cursor = layoutNode(root, 0, collapsed, cursor);
            cursor += ROW_GAP * 3;
        });

        const allN = [], allE = [];
        roots.forEach(r => { flattenTree(r, collapsed, allN); collectEdges(r, collapsed, allE); });

        if (matchIds) allN.forEach(n => { n._dim = !matchIds.has(n.id); });

        const maxX = allN.reduce((m, n) => Math.max(m, n.x + NODE_W), 0);
        const maxY = allN.reduce((m, n) => Math.max(m, n.y + NODE_H), 0);

        return { allNodes: allN, allEdges: allE, svgW: maxX + 60, svgH: maxY + 60, rootNode: roots[0] || null };
    }, [flatData, collapsed, searchTerm]);

    /* ── Fit to screen ── */
    const fitView = useCallback(() => {
        if (!svgRef.current || svgW === 0) return;
        const { width, height } = svgRef.current.getBoundingClientRect();
        const newZoom = Math.min((width - 80) / svgW, (height - 120) / svgH, 1.4);
        setZoom(Math.max(0.15, newZoom));
        setPan({ x: 40, y: 80 });
    }, [svgW, svgH]);

    useEffect(() => {
        if (!loading && allNodes.length > 0) setTimeout(fitView, 120);
    }, [loading, allNodes.length, fitView]);

    /* ── Pan/zoom ── */
    const handleWheel = useCallback(e => {
        e.preventDefault();
        setZoom(z => Math.min(2.5, Math.max(0.15, z * (e.deltaY < 0 ? 1.12 : 0.89))));
    }, []);
    const handleMouseDown = useCallback(e => {
        if (e.button !== 0) return;
        dragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
    }, []);
    const handleMouseMove = useCallback(e => {
        if (!dragging.current) return;
        setPan(p => ({
            x: p.x + (e.clientX - lastPos.current.x),
            y: p.y + (e.clientY - lastPos.current.y),
        }));
        lastPos.current = { x: e.clientX, y: e.clientY };
    }, []);
    const handleMouseUp = useCallback(() => { dragging.current = false; }, []);

    /* ── Touch pan ── */
    const lastTouch = useRef(null);
    const handleTouchStart = useCallback(e => {
        if (e.touches.length === 1) lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, []);
    const handleTouchMove = useCallback(e => {
        if (e.touches.length !== 1 || !lastTouch.current) return;
        const dx = e.touches[0].clientX - lastTouch.current.x;
        const dy = e.touches[0].clientY - lastTouch.current.y;
        lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    }, []);

    const selectedNode = useMemo(() => allNodes.find(n => n.id === selectedId), [allNodes, selectedId]);

    /* ── Label for glass badge ── */
    const branchLabel = userRole?.unitName || rootNode?.name || 'Church Directory';
    const branchType  = rootNode?.unit_type || 'BRANCH';
    const branchIcon  = TYPE_ICON[branchType] || '🏛';
    const branchColor = TYPE_COLOR[branchType] || '#eab308';

    return (
        /* Full-bleed: same background as dashboard — pure black radial + blue dot grid */
        <div
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                /* Dashboard gradient-dark */
                background: 'radial-gradient(circle at 50% 50%, #000108 0%, #000000 100%)',
            }}
        >
            {/* Dashboard dot-pattern overlay (matches MainLayout's bg-dot-pattern layer) */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
                backgroundSize: '12px 12px',
                opacity: 0.03,
            }} />

            {/* ── Glass header badge — top center ── */}
            <div style={{
                position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                zIndex: 30, display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${branchColor}30`,
                borderTop: `1px solid ${branchColor}50`,
                borderRadius: 24,
                padding: '8px 18px 8px 12px',
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 4px 12px ${branchColor}10`,
            }}>
                {/* Icon bubble */}
                <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: `${branchColor}15`,
                    border: `1.5px solid ${branchColor}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                    boxShadow: `0 0 12px ${branchColor}20`,
                }}>
                    {branchIcon}
                </div>
                <div>
                    <p style={{
                        margin: 0, fontSize: 8, fontWeight: 900, letterSpacing: '0.18em',
                        textTransform: 'uppercase', color: branchColor,
                        lineHeight: 1, marginBottom: 3,
                    }}>
                        {branchType}
                    </p>
                    <p style={{
                        margin: 0, fontSize: 13, fontWeight: 800, color: '#f1f5f9',
                        lineHeight: 1.1, letterSpacing: '-0.01em',
                    }}>
                        {branchLabel}
                    </p>
                </div>
            </div>

            {/* ── Search bar — top right ── */}
            <div style={{
                position: 'absolute', top: 16, right: 20, zIndex: 30,
                display: 'flex', alignItems: 'center',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '7px 12px',
                gap: 8,
            }}>
                <Search size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search units..."
                    style={{
                        background: 'none', border: 'none', outline: 'none',
                        color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit',
                        width: 150,
                    }}
                />
            </div>

            {/* ── SVG canvas ── */}
            {loading ? (
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 10,
                }}>
                    <div style={{
                        width: 36, height: 36,
                        border: '3px solid rgba(59,130,246,0.2)',
                        borderTopColor: '#3b82f6', borderRadius: '50%',
                        animation: 'spin 0.75s linear infinite',
                    }} />
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
            ) : (
                <svg
                    ref={svgRef}
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        cursor: dragging.current ? 'grabbing' : 'grab',
                        zIndex: 1,
                    }}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleMouseUp}
                >
                    <defs>
                        <filter id="halo" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="5" result="blur" />
                            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                    </defs>

                    <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                        {/* Subtle dot grid (just within the SVG scene) */}
                        <defs>
                            <pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse">
                                <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.07)" />
                            </pattern>
                        </defs>
                        <rect
                            x={-pan.x / zoom - 200} y={-pan.y / zoom - 200}
                            width={svgW + 600} height={svgH + 600}
                            fill="url(#dots)"
                        />

                        {/* Edges */}
                        {allEdges.map((e, i) => <Edge key={i} parent={e.parent} child={e.child} />)}

                        {/* Nodes */}
                        {allNodes.map(node => (
                            <g key={node.id} opacity={node._dim ? 0.15 : 1}
                               style={{ transition: 'opacity 0.25s' }}>
                                <NodeCard
                                    node={node}
                                    collapsed={collapsed}
                                    onToggle={toggle}
                                    onSelect={setSelectedId}
                                    selectedId={selectedId}
                                />
                            </g>
                        ))}
                    </g>
                </svg>
            )}

            {/* ── Selected node details panel ── */}
            {selectedNode && (
                <div style={{
                    position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
                    width: 240, zIndex: 40,
                    background: 'rgba(6,10,20,0.96)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderLeft: `3px solid ${TYPE_COLOR[selectedNode.unit_type] || '#3b82f6'}`,
                    borderRadius: 16, padding: 16,
                    boxShadow: '0 30px 70px rgba(0,0,0,0.7)',
                }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                        <span style={{
                            fontSize:8, fontWeight:900, letterSpacing:'0.14em', textTransform:'uppercase',
                            color: TYPE_COLOR[selectedNode.unit_type] || '#3b82f6',
                        }}>
                            {TYPE_ICON[selectedNode.unit_type]} {selectedNode.unit_type}
                        </span>
                        <button
                            onClick={() => setSelectedId(null)}
                            style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:20, lineHeight:1, padding:0 }}
                        >×</button>
                    </div>

                    <p style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', marginBottom:12 }}>
                        {selectedNode.name}
                    </p>

                    {selectedNode.leaders?.length > 0 && (
                        <div style={{ marginBottom:10 }}>
                            <p style={{ fontSize:8, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.1em', color:'#475569', marginBottom:6 }}>
                                Leaders
                            </p>
                            {selectedNode.leaders.map((l, i) => (
                                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                                    <div style={{
                                        width:28, height:28, borderRadius:'50%', background:'#111827',
                                        border:`1px solid ${TYPE_COLOR[selectedNode.unit_type]}33`,
                                        overflow:'hidden', flexShrink:0,
                                        display:'flex', alignItems:'center', justifyContent:'center',
                                        fontSize:11, color:'#94a3b8',
                                    }}>
                                        {l.photo ? <img src={l.photo} alt={l.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : l.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <p style={{ fontSize:11, fontWeight:600, color:'#e2e8f0', margin:0 }}>{l.name}</p>
                                        <p style={{ fontSize:9, color:'#64748b', margin:0 }}>{l.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedNode.members?.length > 0 && (
                        <div style={{ marginBottom:12 }}>
                            <p style={{ fontSize:8, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.1em', color:'#475569', marginBottom:6 }}>
                                Members ({selectedNode.members.length})
                            </p>
                            {selectedNode.members.slice(0, 4).map((m, i) => (
                                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                                    <div style={{
                                        width:22, height:22, borderRadius:'50%', background:'#111827',
                                        border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', flexShrink:0,
                                        display:'flex', alignItems:'center', justifyContent:'center',
                                        fontSize:9, color:'#64748b',
                                    }}>
                                        {m.photo ? <img src={m.photo} alt={m.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : m.name?.charAt(0)}
                                    </div>
                                    <p style={{ fontSize:10, color:'#94a3b8', margin:0 }}>{m.name}</p>
                                </div>
                            ))}
                            {selectedNode.members.length > 4 && (
                                <p style={{ fontSize:9, color:'#475569' }}>+{selectedNode.members.length - 4} more</p>
                            )}
                        </div>
                    )}

                    <button
                        onClick={() => { setTargetParent(selectedNode); setIsUnitModalOpen(true); }}
                        style={{
                            width:'100%', padding:'8px 0', borderRadius:10,
                            background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.25)',
                            color:'#60a5fa', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                        }}
                    >
                        + Add Child Unit
                    </button>
                </div>
            )}

            {/* ── Modals ── */}
            <AddUnitModal
                isOpen={isUnitModalOpen}
                onClose={() => setIsUnitModalOpen(false)}
                parentNode={targetParent}
                onSubmit={async (data) => {
                    try {
                        await createUnit({ name: data.name, unit_type: data.unit_type, parent_id: data.parent_id, order_index: 0 });
                        setIsUnitModalOpen(false);
                        refreshData();
                    } catch (e) { console.error(e); }
                }}
            />
            <ImageModal
                isOpen={imgModal.open}
                onClose={() => setImgModal(m => ({ ...m, open: false }))}
                imageSrc={imgModal.src}
                title={imgModal.title}
            />
            <PersonProfileModal
                isOpen={!!personModal}
                onClose={() => setPersonModal(null)}
                person={personModal}
            />
        </div>
    );
}
