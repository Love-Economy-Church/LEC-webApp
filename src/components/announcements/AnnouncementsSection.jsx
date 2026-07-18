import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Megaphone, Plus, Loader2, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import AnnouncementCard from './AnnouncementCard';
import PostAnnouncementModal from './PostAnnouncementModal';

// Mapping: which position titles are considered "leaders who can post"
const LEADER_LEVELS = [1, 2, 3, 4, 5]; // Branch Pastor through Cell Shepherd

// Determine if a given announcement should be visible to a user of a certain level
// target_audience values: 'all', 'church_heads'(2), 'mc_heads'(3), 'buscenta_heads'(4), 'cell_shepherds'(5), 'cell_members'(6)
const AUDIENCE_LEVEL_MAP = {
    all: null, // visible to all
    church_heads: 2,
    mc_heads: 3,
    buscenta_heads: 4,
    cell_shepherds: 5,
    cell_members: 6,
};

function isDescendant(userUnitId, authorUnitId, units) {
    if (!userUnitId || !authorUnitId) return false;
    if (userUnitId === authorUnitId) return true;
    
    let currentId = userUnitId;
    const maxDepth = 20;
    let depth = 0;
    
    while (currentId && depth < maxDepth) {
        const unit = units.find(u => u.id === currentId);
        if (!unit) break;
        if (unit.parent_id === authorUnitId) return true;
        currentId = unit.parent_id;
        depth++;
    }
    return false;
}

export default function AnnouncementsSection({ userRole }) {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPostModal, setShowPostModal] = useState(false);

    const userLevel = userRole?.level || 99;
    const isLeader = LEADER_LEVELS.includes(userLevel);

    const fetchAnnouncements = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch announcements (including unit_id)
            const { data, error } = await supabase
                .from('announcements')
                .select(`
                    id, title, body, target_audience, pinned, created_at, author_id, unit_id,
                    author:author_id(id, full_name, photo_url, assignments:position_assignments(position:positions(title, level)))
                `)
                .order('pinned', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(30);

            if (error) throw error;

            // Fetch unit hierarchy to check nested unit membership
            const { data: unitsData, error: unitsError } = await supabase
                .from('organizational_units')
                .select('id, parent_id');
            
            if (unitsError) throw unitsError;

            // Filter announcements based on user hierarchy and level
            const visible = (data || []).filter(ann => {
                // 1. Must belong to the poster's unit or a sub-unit of it (under the unit head)
                const isWithinHierarchy = !ann.unit_id || isDescendant(userRole?.unitId, ann.unit_id, unitsData || []);
                if (!isWithinHierarchy) return false;

                // 2. Client-side filter based on target audience level
                const authorLevel = ann.author?.assignments?.find(a => a.position)?.position?.level || 99;
                const targetLevel = AUDIENCE_LEVEL_MAP[ann.target_audience];
                
                // If target audience is 'all', targetLevel is null/undefined.
                // Since hierarchy check already passed, anyone under the unit head sees 'all'.
                if (targetLevel === null || targetLevel === undefined) return true;
                
                // Superiors (lower level number) always see everything
                if (userLevel < authorLevel) return true;
                return userLevel === targetLevel;
            });

            setAnnouncements(visible);
        } catch (err) {
            console.error('fetchAnnouncements error:', err);
        } finally {
            setLoading(false);
        }
    }, [userLevel, userRole?.unitId]);

    useEffect(() => {
        fetchAnnouncements();
        // Real-time
        const ch = supabase.channel('announcements-feed')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchAnnouncements())
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [fetchAnnouncements]);

    const handleDeleted = (id) => setAnnouncements(prev => prev.filter(a => a.id !== id));

    return (
        <section>
            {/* Section Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-church-blue-500/10 border border-church-blue-500/20 flex items-center justify-center">
                        <Megaphone size={16} className="text-church-blue-400" />
                    </div>
                    <div>
                        <h2 className="font-black text-white text-base leading-tight">Announcements</h2>
                        <p className="text-[10px] text-slate-500 font-semibold">
                            {announcements.length} active {announcements.length === 1 ? 'post' : 'posts'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchAnnouncements}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all"
                    >
                        <RefreshCw size={14} />
                    </button>
                    {isLeader && (
                        <button
                            onClick={() => setShowPostModal(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-church text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-church-blue-500/20 active:scale-95 transition-transform"
                        >
                            <Plus size={14} />
                            Post
                        </button>
                    )}
                </div>
            </div>

            {/* Feed */}
            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-church-blue-500" size={22} />
                </div>
            ) : announcements.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="w-14 h-14 rounded-3xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
                        <Megaphone size={24} className="text-slate-700" strokeWidth={1.5} />
                    </div>
                    <p className="text-slate-500 text-sm font-semibold">No Announcements Yet</p>
                    {isLeader && (
                        <p className="text-xs text-slate-600 max-w-[220px] leading-relaxed">
                            Post an announcement to broadcast a message to your unit members.
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence>
                        {announcements.map(ann => (
                            <AnnouncementCard
                                key={ann.id}
                                announcement={ann}
                                userRole={userRole}
                                onDeleted={handleDeleted}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Post Modal */}
            <AnimatePresence>
                {showPostModal && (
                    <PostAnnouncementModal
                        userRole={userRole}
                        onClose={() => setShowPostModal(false)}
                        onPosted={fetchAnnouncements}
                    />
                )}
            </AnimatePresence>
        </section>
    );
}
