import { X, User, Users, MapPin, ChevronRight, Activity, Plus, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import ImageModal from './common/ImageModal';
import { useAuth } from '../contexts/AuthContext';

export default function NodeDetailsPanel({ node, onClose, onAddChild, onViewRegistry }) {
    const { user, canManage } = useAuth();
    const [modalConfig, setModalConfig] = useState({ isOpen: false, src: '', title: '' });
    const [hasPermission, setHasPermission] = useState(false);

    useEffect(() => {
        if (node && user && node.data?.unit_type !== 'PERSON') {
            canManage(node.id).then(setHasPermission);
        } else {
            setHasPermission(false);
        }
    }, [node, user, canManage]);

    if (!node) return null;

    const { label, unit_type } = node.data;

    const openImage = (e, src, title) => {
        e.stopPropagation();
        setModalConfig({ isOpen: true, src, title });
    };

    return (
        <>
            <AnimatePresence>
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed md:absolute top-4 right-4 bottom-4 left-4 md:left-auto md:w-96 bg-slate-900/95 backdrop-blur-xl border-2 border-church-blue-500/50 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-slate-700/50 flex items-start justify-between relative overflow-hidden shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-church-blue-500/10 to-church-purple-500/10 pointer-events-none" />

                        <div className="relative z-10">
                            <h2 className="text-xl font-bold text-white leading-tight">{label}</h2>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors relative z-10"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {unit_type === 'PERSON' ? (
                            <div className="flex flex-col items-center p-2 space-y-6 mt-4">
                                {/* Large Avatar */}
                                <div className="w-32 h-32 rounded-full border-4 border-slate-700/50 shadow-2xl overflow-hidden bg-slate-800 flex items-center justify-center relative">
                                    {node.data.photo ? (
                                        <img src={node.data.photo} alt={label} className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={64} className="text-slate-600" />
                                    )}
                                </div>

                                {/* Name & Badge */}
                                <div className="text-center space-y-1">
                                    <h2 className="text-2xl font-black text-white">{label}</h2>
                                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-church-blue-500/10 border border-church-blue-500/20 text-church-blue-400">
                                        {node.data.role || 'Member'}
                                    </span>
                                </div>

                                {/* Info Cards */}
                                <div className="w-full space-y-3 pt-4 border-t border-slate-800">
                                    <InfoCard 
                                        label="Assigned Role" 
                                        value={node.data.role || 'Member'} 
                                        icon={<Shield size={18} />} 
                                        color="blue" 
                                    />
                                    <InfoCard 
                                        label="Church Unit" 
                                        value={node.data.unitName || 'Unknown Unit'} 
                                        icon={<MapPin size={18} />} 
                                        color="purple" 
                                    />
                                </div>
                            </div>
                        ) : (
                        <div className="space-y-4">
                            {/* Leads (Luxurious Yellow) - Cell Shepherd or primary leader */}
                            {(() => {
                                const leaders = node.data.leaders || [];
                                let leads;
                                if (unit_type === 'CELL') {
                                    // ONLY exact 'cell shepherd' role — no fallback to leaders[0]
                                    leads = leaders.filter(l => l.role?.toLowerCase() === 'cell shepherd');
                                } else {
                                    leads = leaders.filter(l => l.role?.toLowerCase() !== 'shepherd');
                                }
                                if (leads.length === 0) return null;
                                return (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between px-1">
                                            <div className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em] opacity-80 decoration-yellow-500/30 underline underline-offset-4">Lead</div>
                                        </div>
                                        {leads.map((leader, i) => (
                                            <div 
                                                key={`cell-p-${i}`} 
                                                className="p-3 rounded-2xl bg-gradient-to-br from-yellow-500/20 via-slate-800 to-slate-900 border border-yellow-500/40 flex items-center gap-3 shadow-xl shadow-yellow-500/5 transition-all group"
                                            >
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); leader.photo && openImage(e, leader.photo, leader.name); }}
                                                    className={`w-11 h-11 rounded-xl border-2 border-yellow-400 overflow-hidden bg-slate-800 flex items-center justify-center shrink-0 shadow-glow-yellow transition-transform group-hover:scale-105 ${leader.photo ? 'cursor-pointer' : ''}`}
                                                >
                                                    {leader.photo ? (
                                                        <img src={leader.photo} alt={leader.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User size={18} className="text-yellow-400" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-base text-white leading-tight truncate">{leader.name}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400 drop-shadow-sm">
                                                        {unit_type === 'CELL' ? 'Cell Shepherd' : leader.role}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            {/* Assistants (Professional Violet) - All non-primary leaders */}
                            {(() => {
                                const leaders = node.data.leaders || [];
                                let assistants;
                                if (unit_type === 'CELL') {
                                    // All non-cell-shepherd leaders are assistants
                                    assistants = leaders.filter(l => l.role?.toLowerCase() !== 'cell shepherd');
                                } else {
                                    assistants = leaders.filter(l => l.role?.toLowerCase() === 'shepherd');
                                }
                                if (assistants.length === 0) return null;
                                return (
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em] px-1 opacity-80 decoration-violet-400/30 underline underline-offset-4">Assistants</div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {assistants.map((leader, i) => (
                                                <div 
                                                    key={`lead-a-${i}`} 
                                                    className="p-2.5 rounded-xl bg-gradient-to-r from-violet-500/10 to-church-purple-500/10 border border-violet-500/20 flex items-center gap-2.5 transition-all group shadow-md"
                                                >
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); leader.photo && openImage(e, leader.photo, leader.name); }}
                                                        className={`w-8.5 h-8.5 rounded-xl border border-violet-500/40 overflow-hidden bg-slate-800 flex items-center justify-center shrink-0 group-hover:border-violet-400 transition-colors ${leader.photo ? 'cursor-pointer' : ''}`}
                                                    >
                                                        {leader.photo ? (
                                                            <img src={leader.photo} alt={leader.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <User size={14} className="text-violet-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-100 text-xs leading-tight group-hover:text-white transition-colors uppercase tracking-tighter">{leader.name}</p>
                                                        <p className="text-[8px] font-black uppercase text-violet-500/80 tracking-widest mt-0.5">{leader.role}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                    
                            {/* Members (Subtle Clean Slate) */}
                            {node.data.members && node.data.members.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] opacity-80 decoration-slate-500/30 underline underline-offset-4">Brethren</div>
                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded-full border border-slate-700/50">{node.data.members.length}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1.5">
                                        {node.data.members.map((member, i) => (
                                            <div 
                                                key={`mem-${i}`} 
                                                className="p-2 rounded-xl bg-slate-800/20 border border-slate-700/20 flex items-center gap-2.5 transition-all group"
                                            >
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); member.photo && openImage(e, member.photo, member.name); }}
                                                    className={`w-8 h-8 rounded-xl bg-slate-900/50 overflow-hidden border border-slate-700/50 flex items-center justify-center shrink-0 transition-all group-hover:border-slate-500 ${member.photo ? 'cursor-pointer' : ''}`}
                                                >
                                                    {member.photo ? (
                                                        <img src={member.photo} alt={member.name} className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all" />
                                                    ) : (
                                                        <User size={13} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition-colors truncate">{member.name}</p>
                                                    <p className="text-[8px] font-medium text-slate-600 uppercase tracking-widest">Member</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        )}

                        {/* Actions */}
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                            {user && hasPermission && unit_type !== 'PERSON' && unit_type !== 'CELL' && (
                                <button
                                    onClick={() => onAddChild(node)}
                                    className="w-full py-2 px-3 bg-gradient-church hover:opacity-90 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 border-2 border-church-blue-600"
                                >
                                    <Plus size={16} />                                     {unit_type === 'ROOT' ? 'ADD BRANCH' : 
                                     unit_type === 'BRANCH' ? 'ADD CHURCH' : 
                                     unit_type === 'CHURCH' ? 'ADD NEW MC' : 
                                     unit_type === 'MC' ? 'ADD BUSCENTA' : 
                                     unit_type === 'BUSCENTA' ? 'ADD CELL' : 'ADD SUB-UNIT'}
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            <ImageModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                imageSrc={modalConfig.src}
                title={modalConfig.title}
            />
        </>
    );
}

function Badge({ type }) {
    const colors = {
        BRANCH: 'bg-church-yellow-500/20 text-church-yellow-300 border-church-yellow-500/30',
        CHURCH: 'bg-church-purple-500/20 text-church-purple-300 border-church-purple-500/30',
        MC: 'bg-church-blue-500/20 text-church-blue-300 border-church-blue-500/30',
        BUSCENTA: 'bg-church-magenta-500/20 text-church-magenta-300 border-church-magenta-500/30',
        CELL: 'bg-church-coral-500/20 text-church-coral-300 border-church-coral-500/30',
        PERSON: 'bg-slate-700 text-slate-300 border-slate-600',
    };

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${colors[type] || colors.PERSON}`}>
            {type}
        </span>
    );
}

function InfoCard({ label, value, icon, color }) {
    const colors = {
        blue: 'text-church-blue-400 bg-church-blue-500/10',
        purple: 'text-church-purple-400 bg-church-purple-500/10',
    };

    return (
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
                <div className={`p-1 rounded ${colors[color]}`}>
                    {icon}
                </div>
                <span className="text-xs text-slate-500 font-medium">{label}</span>
            </div>
            <p className="text-sm font-semibold text-slate-200">{value}</p>
        </div>
    );
}

