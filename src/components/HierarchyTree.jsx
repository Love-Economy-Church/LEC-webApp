import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchHierarchyData } from "../services/hierarchyService";
import {
    ChevronRight,
    ChevronDown,
    User,
    Users,
    FolderTree,
    Search,
    PlusSquare,
    MinusSquare,
    Activity,
    List,
    Network
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ImageModal from "./common/ImageModal";
import MindMapDrillDown from "./MindMapDrillDown";

import { buildTree, filterNodes } from "../utils/treeUtils";
import { useAuth } from "../contexts/AuthContext";
import ErrorState from "./ui/ErrorState";

// ================================
// TREE NODE COMPONENT
// ================================
function TreeNode({ node, level = 0, defaultOpen = false, expansionToggle, onImageClick }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const hasChildren = node.children && node.children.length > 0;

    // Expand/Collapse recursively when global signal changes
    useEffect(() => {
        if (expansionToggle) {
            setIsOpen(expansionToggle.state);
        }
    }, [expansionToggle]);

    // Force open if search is active
    useEffect(() => {
        if (defaultOpen) setIsOpen(true);
    }, [defaultOpen]);

    // Visual cues for different unit types
    const getStyles = (type) => {
        switch (type) {
            case 'BRANCH': return {
                bg: 'bg-slate-800',
                border: 'border-l-4 border-l-church-yellow-500 border-t border-r border-b border-slate-700',
                text: 'text-church-yellow-300',
                icon: <FolderTree size={22} className="text-church-yellow-400" />
            };
            case 'CHURCH': return {
                bg: 'bg-slate-800',
                border: 'border-l-4 border-l-church-purple-500 border-t border-r border-b border-slate-700',
                text: 'text-church-purple-300',
                icon: <FolderTree size={22} className="text-church-purple-400" />
            };
            case 'MC': return {
                bg: 'bg-slate-800',
                border: 'border-l-4 border-l-church-blue-500 border-t border-r border-b border-slate-700',
                text: 'text-church-blue-300',
                icon: <Activity size={20} className="text-church-blue-400" />
            };
            case 'BUSCENTA': return {
                bg: 'bg-slate-800',
                border: 'border-l-4 border-l-church-magenta-500 border-t border-r border-b border-slate-700',
                text: 'text-church-magenta-300',
                icon: <Users size={20} className="text-church-magenta-400" />
            };
            case 'CELL': return {
                bg: 'bg-slate-800',
                border: 'border-l-4 border-l-church-coral-500 border-t border-r border-b border-slate-700',
                text: 'text-church-coral-300',
                icon: <User size={18} className="text-church-coral-400" />
            };
            default: return {
                bg: 'bg-slate-800',
                border: 'border border-slate-700',
                text: 'text-slate-300',
                icon: <div className="w-4" />
            };
        }
    };

    const style = getStyles(node.unit_type);

    return (
        <div className="relative pl-1.5 md:pl-6">
            {/* Connector Lines */}
            {level > 0 && (
                <>
                    {/* Vertical line from parent */}
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-church-blue-500/50" />
                    {/* Horizontal curve to node */}
                    <div className="absolute left-0 top-8 w-3 md:w-6 h-px bg-church-blue-500/50" />
                </>
            )}

            <div className="py-2">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`
                        relative group rounded-xl overflow-hidden transition-all duration-300 shadow-lg
                        ${style.bg} ${style.border} hover:shadow-xl
                    `}
                >
                    {/* Header / Clickable Area */}
                    <div
                        className="p-3 flex items-center justify-between cursor-pointer select-none"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <div className="flex items-center justify-between w-full">

                            {/* Icon & Name */}
                            <div className="flex items-center gap-2">
                                {/* {style.icon} */}
                                <span className={`font-semibold tracking-wide text-sm md:text-base ${style.text}`}>
                                    {node.name}
                                </span>
                                {node.is_placeholder && (
                                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                        Pending
                                    </span>
                                )}
                            </div>
                            {/* Expand Toggle */}
                            <div className={`p-1 rounded-md transition-colors ${hasChildren ? 'hover:bg-white/10 text-slate-400' : 'opacity-0'}`}>
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                        </div>

                        {/* Quick Stats or Badges could go here */}
                    </div>

                    {/* Personnel Section (Tiers) */}
                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-white/10 bg-black/20"
                            >
                                <div className="p-3 pl-4 md:pl-11 space-y-4">
                                    {/* Cell Shepherds Section (Luxurious Yellow) */}
                                    {(() => {
                                        const leaders = node.leaders || [];
                                        // For CELL units: ONLY exact 'cell shepherd' role — no fallback
                                        let cellShepherds;
                                        if (node.unit_type === 'CELL') {
                                            cellShepherds = leaders.filter(l => l.role?.toLowerCase() === 'cell shepherd');
                                        } else {
                                            cellShepherds = leaders.filter(l => l.role?.toLowerCase() === 'cell shepherd');
                                        }
                                        return cellShepherds.map((leader, idx) => (
                                            <div key={`lead-${idx}`} className="flex items-center gap-3 group">
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        leader.photo && onImageClick && onImageClick(leader.photo, leader.name);
                                                    }}
                                                    className={`relative w-8 h-8 rounded-full border-2 border-yellow-500/50 shadow-glow-yellow overflow-hidden bg-slate-800 shrink-0 transition-transform group-hover:scale-110 ${leader.photo ? 'cursor-pointer' : ''}`}
                                                >
                                                    {leader.photo ? (
                                                        <img src={leader.photo} alt={leader.name} className="w-full h-full object-cover" />
                                                    ) : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-yellow-500">{leader.name.charAt(0)}</div>}
                                                </div>
                                                <div>
                                                    <p className="text-xs md:text-sm font-bold text-white leading-tight group-hover:text-yellow-400 transition-colors uppercase tracking-tight">{leader.name}</p>
                                                    <p className="text-[9px] md:text-[10px] text-yellow-500/70 font-black uppercase tracking-[0.2em] decoration-yellow-500/30 underline underline-offset-2">Cell Shepherd</p>
                                                </div>
                                            </div>
                                        ));
                                    })()}

                                    {/* Shepherds Section (Professional Violet) */}
                                    {(() => {
                                        const leaders = node.leaders || [];
                                        let assistants;
                                        if (node.unit_type === 'CELL') {
                                            // All non-cell-shepherd leaders are assistants (violet)
                                            assistants = leaders.filter(l => l.role?.toLowerCase() !== 'cell shepherd');
                                        } else {
                                            assistants = leaders.filter(l => l.role?.toLowerCase() !== 'cell shepherd');
                                        }
                                        return assistants.map((leader, idx) => (
                                            <div key={`asst-${idx}`} className="flex items-center gap-3 opacity-90 group">
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        leader.photo && onImageClick && onImageClick(leader.photo, leader.name);
                                                    }}
                                                    className={`relative w-7 h-7 rounded-full border border-emerald-500/50 shadow-glow-emerald overflow-hidden bg-slate-800 shrink-0 transition-transform group-hover:scale-105 ${leader.photo ? 'cursor-pointer' : ''}`}
                                                >
                                                    {leader.photo ? (
                                                        <img src={leader.photo} alt={leader.name} className="w-full h-full object-cover" />
                                                    ) : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-emerald-400">{leader.name.charAt(0)}</div>}
                                                </div>
                                                <div>
                                                    <p className="text-[11px] md:text-xs font-bold text-slate-100 leading-tight group-hover:text-emerald-400 transition-colors uppercase tracking-tighter">{leader.name}</p>
                                                    <p className="text-[8px] md:text-[9px] text-emerald-400/80 font-black uppercase tracking-widest mt-1">{leader.role}</p>
                                                </div>
                                            </div>
                                        ));
                                    })()}

                                    {/* Hierarchy Separation / Operational Break */}
                                    {node.members?.length > 0 && (
                                        <div className="relative py-1">
                                            <div className="absolute inset-x-0 top-1/2 h-px bg-white/5" />
                                            <div className="relative flex justify-center">
                                                <span className="bg-slate-900 border border-white/5 rounded-full px-2 py-0.5 text-[8px] font-black text-slate-600 uppercase tracking-widest">General Membership</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Members Section (Subtle Clean Slate) */}
                                    {node.members && node.members.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between px-1 mb-2">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Brethren</span>
                                                <span className="text-[9px] font-bold text-slate-600 bg-slate-800/80 px-1.5 py-0.5 rounded-full border border-slate-700">{node.members.length}</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {node.members.map((member, idx) => (
                                                    <div key={`mem-${idx}`} className="flex items-center gap-2 group p-1 rounded-lg hover:bg-white/5 transition-colors">
                                                        <div 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                member.photo && onImageClick && onImageClick(member.photo, member.name);
                                                            }}
                                                            className={`w-5 h-5 rounded-full bg-slate-700 border border-slate-600 overflow-hidden shrink-0 transition-all group-hover:border-slate-500 ${member.photo ? 'cursor-pointer' : ''}`}
                                                        >
                                                            {member.photo ? <img src={member.photo} alt="" className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0" /> : null}
                                                        </div>
                                                        <span className="text-[10px] font-medium text-slate-500 truncate group-hover:text-slate-300 transition-colors">{member.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Recursive Children */}
                <AnimatePresence>
                    {isOpen && hasChildren && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="ml-1 md:ml-2">
                                {node.children.map(child => (
                                    <TreeNode
                                        key={child.id}
                                        node={child}
                                        level={level + 1}
                                        defaultOpen={defaultOpen}
                                        expansionToggle={expansionToggle}
                                        onImageClick={onImageClick}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// ================================
// MAIN COMPONENT
// ================================
export default function HierarchyTree({ focusTrigger }) {
    const { getManagedUnits } = useAuth();
    const [originalTree, setOriginalTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [expansionToggle, setExpansionToggle] = useState(null);
    const [imageModalConfig, setImageModalConfig] = useState({ isOpen: false, src: '', title: '' });

    // View mode: 'map' (new drill-down) or 'tree' (existing list)
    const [viewMode, setViewMode] = useState(
        () => localStorage.getItem('hierarchy_view_preference') || 'map'
    );

    const switchView = (mode) => {
        setViewMode(mode);
        localStorage.setItem('hierarchy_view_preference', mode);
    };

    useEffect(() => {
        if (focusTrigger) {
            setExpansionToggle({ state: true, timestamp: Date.now() });
        }
    }, [focusTrigger]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [managedUnits, data] = await Promise.all([
                getManagedUnits(),
                fetchHierarchyData()
            ]);
            let filteredData = data;
            if (managedUnits !== 'ALL') {
                filteredData = data.filter(unit => managedUnits.has(unit.id));
            }
            setOriginalTree(buildTree(filteredData));
        } catch (err) {
            console.error('Failed to load hierarchy:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [getManagedUnits]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const displayedTree = useMemo(() => {
        if (!searchTerm) return originalTree;
        return filterNodes(originalTree, searchTerm);
    }, [originalTree, searchTerm]);

    const isFiltered = useMemo(() => searchTerm.length > 0, [searchTerm]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-church-blue-500"></div>
            <p className="text-slate-400 animate-pulse font-semibold">Loading Structure...</p>
        </div>
    );

    if (error) return (
        <ErrorState variant="full" error={error} onRetry={loadData} retrying={loading} />
    );

    return (
        <div className="space-y-5 md:space-y-6">
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                <div>
                    <h2 className="text-3xl font-black bg-gradient-church bg-clip-text text-transparent">
                        Organizational Structure
                    </h2>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* View Toggle */}
                    <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-700 shrink-0">
                        <button
                            onClick={() => switchView('map')}
                            title="Mind Map View"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                                viewMode === 'map'
                                    ? 'bg-church-blue-600 text-white shadow'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Network size={13} />
                            Map
                        </button>
                        <button
                            onClick={() => switchView('tree')}
                            title="Tree List View"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                                viewMode === 'tree'
                                    ? 'bg-church-blue-600 text-white shadow'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <List size={13} />
                            List
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-church-blue-400 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Find person or unit..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 w-full md:w-64 text-sm focus:outline-none focus:border-church-blue-500 focus:ring-2 focus:ring-church-blue-500/50 transition-all placeholder:text-slate-500 text-slate-200 font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Render selected view */}
            <AnimatePresence mode="wait">
                {viewMode === 'map' ? (
                    <motion.div
                        key="map-view"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                    >
                        <MindMapDrillDown searchTerm={searchTerm} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="tree-view"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="min-h-[400px]"
                    >
                        {displayedTree.length === 0 ? (
                            <div className="text-center py-20 opacity-50">
                                <FolderTree size={48} className="mx-auto mb-4 text-slate-600" />
                                <p className="text-lg font-medium text-slate-400">No matching units found</p>
                                <p className="text-sm text-slate-600">Try adjusting your search filters</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {displayedTree.map((node) => (
                                    <TreeNode
                                        key={node.id}
                                        node={node}
                                        defaultOpen={isFiltered || displayedTree.length === 1}
                                        expansionToggle={expansionToggle}
                                        onImageClick={(src, title) => setImageModalConfig({ isOpen: true, src, title })}
                                    />
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <ImageModal
                isOpen={imageModalConfig.isOpen}
                onClose={() => setImageModalConfig(prev => ({ ...prev, isOpen: false }))}
                imageSrc={imageModalConfig.src}
                title={imageModalConfig.title}
            />
        </div>
    );
}
