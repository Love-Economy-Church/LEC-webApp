import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { NODE_DIMS } from '../utils/mindmapLayoutUtils';

/* ─── Per-type visual config ──────────────────────────────────────── */
const TYPE_CONFIG = {
    ROOT:     { icon: '✦',  label: 'Root',     accent: '#94a3b8', glow: 'rgba(148,163,184,0.25)' },
    BRANCH:   { icon: '🏛',  label: 'Branch',   accent: '#eab308', glow: 'rgba(234,179,8,0.25)'   },
    CHURCH:   { icon: '⛪',  label: 'Church',   accent: '#8b5cf6', glow: 'rgba(139,92,246,0.25)'  },
    MC:       { icon: '🧩',  label: 'MC',       accent: '#3b82f6', glow: 'rgba(59,130,246,0.25)'  },
    BUSCENTA: { icon: '🌐',  label: 'Buscenta', accent: '#ec4899', glow: 'rgba(236,72,153,0.25)'  },
    CELL:     { icon: '🔵',  label: 'Cell',     accent: '#f97316', glow: 'rgba(249,115,22,0.25)'  },
    PERSON:   { icon: '👤',  label: 'Person',   accent: '#10b981', glow: 'rgba(16,185,129,0.25)'  },
};

const ROLE_ACCENT = {
    'cell shepherd': { accent: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
    'shepherd':      { accent: '#8b5cf6', glow: 'rgba(139,92,246,0.25)' },
};

function Avatar({ photo, name, size = 22 }) {
    return (
        <div
            style={{
                width: size, height: size,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '1.5px solid rgba(255,255,255,0.15)',
                background: '#1e293b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                fontSize: size * 0.45,
                fontWeight: 700,
                color: '#94a3b8',
            }}
        >
            {photo
                ? <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (name?.charAt(0) || '?')
            }
        </div>
    );
}

const CollapsibleNode = memo(({ data, isConnectable }) => {
    const isPerson   = data.unit_type === 'PERSON';
    const roleLower  = (data.role || '').toLowerCase();
    const typeConf   = TYPE_CONFIG[data.unit_type] || TYPE_CONFIG.ROOT;
    const dims       = isPerson ? NODE_DIMS.PERSON : NODE_DIMS.DEFAULT;

    // Persons: override color by role
    let accent = typeConf.accent;
    let glow   = typeConf.glow;
    if (isPerson && ROLE_ACCENT[roleLower]) {
        accent = ROLE_ACCENT[roleLower].accent;
        glow   = ROLE_ACCENT[roleLower].glow;
    }

    // Primary leader
    const primaryLeader = data.unit_type === 'CELL'
        ? (data.leaders?.find(l => l.role?.toLowerCase() === 'cell shepherd') || data.leaders?.[0])
        : data.leaders?.[0];

    const memberCount = (data.members?.length || 0);
    const leaderCount = (data.leaders?.length || 0);
    const totalPeople = memberCount + leaderCount;

    // The card must exactly fill the node's declared width & height so
    // ReactFlow's bounding-box measurement matches what the user sees.
    return (
        <div
            style={{
                width:  dims.width,
                height: dims.height,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
            }}
        >
            {/* ReactFlow connection handles (invisible — we use smoothstep edges) */}
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                style={{ opacity: 0, pointerEvents: 'none' }}
            />
            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                style={{ opacity: 0, pointerEvents: 'none' }}
            />

            {/* ── Main Card ─────────────────────────────────────────── */}
            <div style={{
                width:    '100%',
                height:   '100%',
                background: 'linear-gradient(135deg, #0f172a 0%, #0d1525 100%)',
                borderRadius: 14,
                border: `1px solid rgba(255,255,255,0.08)`,
                borderLeft: `3px solid ${accent}`,
                boxShadow: `0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)`,
                overflow: 'hidden',
                cursor: 'default',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: isPerson ? '8px 12px' : '10px 14px',
                boxSizing: 'border-box',
            }}>
                {isPerson ? (
                    /* ── Person Node ─────────────────────────────────── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
                        <div
                            onClick={e => {
                                e.stopPropagation();
                                data.photo && data.onImageClick && data.onImageClick(data.photo, data.label);
                            }}
                            style={{ cursor: data.photo ? 'pointer' : 'default' }}
                        >
                            <Avatar photo={data.photo} name={data.label} size={36} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                fontSize: 11, fontWeight: 700, color: '#f1f5f9',
                                lineHeight: 1.3,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                maxWidth: dims.width - 24,
                            }}>
                                {data.label}
                            </div>
                            <div style={{
                                marginTop: 2,
                                fontSize: 9, fontWeight: 800,
                                letterSpacing: '0.08em', textTransform: 'uppercase',
                                color: accent,
                            }}>
                                {data.role || 'Member'}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Unit Node ───────────────────────────────────── */
                    <div style={{ width: '100%' }}>
                        {/* Header row: icon + type badge + member count */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                            <span style={{ fontSize: 13, lineHeight: 1 }}>{typeConf.icon}</span>
                            <span style={{
                                fontSize: 8, fontWeight: 900, letterSpacing: '0.15em',
                                textTransform: 'uppercase', color: accent,
                                background: `${accent}1a`,
                                border: `1px solid ${accent}40`,
                                borderRadius: 4, padding: '1px 5px',
                            }}>
                                {data.unit_type}
                            </span>
                            {totalPeople > 0 && (
                                <span style={{
                                    marginLeft: 'auto',
                                    fontSize: 9, fontWeight: 700, color: '#64748b',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    borderRadius: 20, padding: '1px 6px',
                                }}>
                                    {totalPeople}
                                </span>
                            )}
                        </div>

                        {/* Unit name */}
                        <div style={{
                            fontSize: 13, fontWeight: 700, color: '#f1f5f9',
                            lineHeight: 1.3, marginBottom: primaryLeader ? 7 : 0,
                            overflow: 'hidden', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            maxWidth: dims.width - 28,
                        }}>
                            {data.label}
                        </div>

                        {/* Primary leader row */}
                        {primaryLeader && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                paddingTop: 6,
                                borderTop: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                <div
                                    onClick={e => {
                                        e.stopPropagation();
                                        data.onImageClick && primaryLeader.photo && data.onImageClick(primaryLeader.photo, primaryLeader.name);
                                    }}
                                    style={{ cursor: primaryLeader.photo ? 'pointer' : 'default' }}
                                >
                                    <Avatar photo={primaryLeader.photo} name={primaryLeader.name} size={22} />
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{
                                        fontSize: 10.5, fontWeight: 600, color: '#cbd5e1',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {primaryLeader.name}
                                    </div>
                                    {leaderCount > 1 && (
                                        <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>
                                            +{leaderCount - 1} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Expand / Collapse Toggle ───────────────────────────── */}
            {data.hasChildren && (
                <div
                    onClick={e => {
                        e.stopPropagation();
                        data.onToggle(data.id);
                    }}
                    title={data.isCollapsed ? 'Expand' : 'Collapse'}
                    style={{
                        position: 'absolute',
                        right: -13,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 22, height: 22,
                        borderRadius: '50%',
                        background: `#0a0f1c`,
                        border: `1.5px solid ${accent}`,
                        boxShadow: `0 0 8px ${glow}, 0 2px 6px rgba(0,0,0,0.6)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 50,
                        color: accent,
                        fontSize: 12,
                        fontWeight: 900,
                        userSelect: 'none',
                        transition: 'box-shadow 0.15s',
                    }}
                >
                    {data.isCollapsed ? '+' : '−'}
                </div>
            )}
        </div>
    );
});

export default CollapsibleNode;
