import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageSquare, ChevronDown, ChevronUp, Send, Loader2, Trash2, Pin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJI_OPTIONS = ['👍', '❤️', '🙏', '🔥', '👏', '🕊️'];

const AUDIENCE_LABELS = {
    all: 'Everyone',
    church_heads: 'Church Heads',
    mc_heads: 'MC Heads',
    buscenta_heads: 'Buscenta Heads',
    cell_shepherds: 'Cell Shepherds',
    cell_members: 'Cell Members',
};

function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default function AnnouncementCard({ announcement, userRole, onDeleted }) {
    const [reactions, setReactions] = useState([]);
    const [replies, setReplies] = useState([]);
    const [showReplies, setShowReplies] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [loadingReplies, setLoadingReplies] = useState(false);

    const isAuthor = String(announcement.author_id) === String(userRole?.personId);
    const isAdmin  = userRole?.level <= 2;
    const canDelete = isAuthor || isAdmin;

    // ── Load reactions ──────────────────────────────────────────────────────
    useEffect(() => {
        fetchReactions();
        // Real-time reactions
        const ch = supabase.channel(`reactions-${announcement.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_reactions', filter: `announcement_id=eq.${announcement.id}` },
                () => fetchReactions())
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [announcement.id]);

    const fetchReactions = async () => {
        const { data } = await supabase
            .from('announcement_reactions')
            .select('emoji, person_id')
            .eq('announcement_id', announcement.id);
        setReactions(data || []);
    };

    // ── Load replies ────────────────────────────────────────────────────────
    const fetchReplies = async () => {
        setLoadingReplies(true);
        const { data } = await supabase
            .from('announcement_replies')
            .select('id, message, created_at, author:author_id(id, full_name, photo_url, assignments:position_assignments(position:positions(title)))')
            .eq('announcement_id', announcement.id)
            .order('created_at', { ascending: true });
        setReplies(data || []);
        setLoadingReplies(false);
    };

    useEffect(() => {
        if (!showReplies) return;
        fetchReplies();
        const ch = supabase.channel(`replies-${announcement.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_replies', filter: `announcement_id=eq.${announcement.id}` },
                () => fetchReplies())
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [showReplies, announcement.id]);

    // ── Toggle emoji reaction ───────────────────────────────────────────────
    const handleReact = async (emoji) => {
        if (!userRole?.personId) return;
        const already = reactions.find(r => r.emoji === emoji && r.person_id === userRole.personId);
        if (already) {
            await supabase.from('announcement_reactions')
                .delete()
                .eq('announcement_id', announcement.id)
                .eq('person_id', userRole.personId)
                .eq('emoji', emoji);
        } else {
            await supabase.from('announcement_reactions')
                .insert([{ announcement_id: announcement.id, person_id: userRole.personId, emoji }]);
        }
        fetchReactions();
    };

    // ── Send reply ──────────────────────────────────────────────────────────
    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!replyText.trim() || !userRole?.personId) return;
        setSendingReply(true);
        await supabase.from('announcement_replies').insert([{
            announcement_id: announcement.id,
            author_id: userRole.personId,
            message: replyText.trim(),
        }]);
        setReplyText('');
        setSendingReply(false);
        fetchReplies();
    };

    // ── Delete announcement ─────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!window.confirm('Delete this announcement?')) return;
        const { error } = await supabase.from('announcements').delete().eq('id', announcement.id);
        if (error) {
            console.error('[Delete Announcement Error]:', error);
            alert(`Failed to delete announcement: ${error.message}`);
            return;
        }
        onDeleted?.(announcement.id);
    };

    // ── Aggregate reactions for display ────────────────────────────────────
    const reactionCounts = EMOJI_OPTIONS.map(emoji => ({
        emoji,
        count: reactions.filter(r => r.emoji === emoji).length,
        reacted: reactions.some(r => r.emoji === emoji && r.person_id === userRole?.personId),
    })).filter(r => r.count > 0 || false);

    const totalReplies = replies.length;

    const author = announcement.author;
    const authorName = author?.full_name || 'Unknown';
    const authorRole = author?.assignments?.find(a => a.position)?.position?.title || '';
    const authorPhoto = author?.photo_url;

    const getInitials = (name = '') => name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border overflow-hidden ${announcement.pinned ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/[0.06] bg-white/[0.03]'}`}
        >
            {/* Pinned Banner */}
            {announcement.pinned && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20">
                    <Pin size={11} className="text-amber-400" />
                    <span className="text-[9px] text-amber-400 font-black uppercase tracking-widest">Pinned</span>
                </div>
            )}

            <div className="p-4 md:p-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                        {/* Author Avatar */}
                        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-church-blue-700 to-slate-800 overflow-hidden flex items-center justify-center border border-white/10 shrink-0">
                            {authorPhoto
                                ? <img src={authorPhoto} alt={authorName} className="w-full h-full object-cover" />
                                : <span className="text-white font-black text-[10px]">{getInitials(authorName)}</span>
                            }
                        </div>
                        <div>
                            <p className="font-black text-slate-100 text-sm leading-tight">{authorName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                {authorRole && <span className="text-[9px] text-church-blue-400 font-black uppercase tracking-wider">{authorRole}</span>}
                                <span className="text-[9px] text-slate-600 font-semibold">{timeAgo(announcement.created_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Audience badge */}
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 bg-white/[0.04] border border-white/[0.06] px-2 py-1 rounded-lg">
                            → {AUDIENCE_LABELS[announcement.target_audience] || announcement.target_audience}
                        </span>
                        {canDelete && (
                            <button onClick={handleDelete} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Title + Body */}
                <h3 className="font-black text-white text-base mb-1.5 leading-snug">{announcement.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">{announcement.body}</p>

                {/* Emoji Reactions */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                    {EMOJI_OPTIONS.map(emoji => {
                        const rc = reactions.filter(r => r.emoji === emoji).length;
                        const reacted = reactions.some(r => r.emoji === emoji && r.person_id === userRole?.personId);
                        return (
                            <button
                                key={emoji}
                                onClick={() => handleReact(emoji)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-sm font-bold transition-all active:scale-90 border ${
                                    reacted
                                        ? 'bg-church-blue-500/20 border-church-blue-500/40 text-white'
                                        : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
                                }`}
                            >
                                <span>{emoji}</span>
                                {rc > 0 && <span className="text-[10px] tabular-nums">{rc}</span>}
                            </button>
                        );
                    })}
                </div>

                {/* Reply toggle */}
                <button
                    onClick={() => setShowReplies(v => !v)}
                    className="flex items-center gap-2 mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors font-semibold"
                >
                    <MessageSquare size={13} />
                    <span>{showReplies ? 'Hide' : 'View'} Replies {totalReplies > 0 ? `(${totalReplies})` : ''}</span>
                    {showReplies ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
            </div>

            {/* Replies Section */}
            <AnimatePresence>
                {showReplies && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-white/[0.05] bg-black/20 px-4 md:px-5 py-4 space-y-3">
                            {loadingReplies ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="animate-spin text-church-blue-500" size={18} />
                                </div>
                            ) : replies.length === 0 ? (
                                <p className="text-xs text-slate-600 text-center py-2">No replies yet. Be the first!</p>
                            ) : (
                                replies.map(reply => {
                                    const rAuthorName = reply.author?.full_name || 'Someone';
                                    const rAuthorRole = reply.author?.assignments?.find(a => a.position)?.position?.title || '';
                                    const rAuthorPhoto = reply.author?.photo_url;
                                    return (
                                        <div key={reply.id} className="flex items-start gap-2.5">
                                            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-church-blue-800 to-slate-800 overflow-hidden flex items-center justify-center border border-white/10 shrink-0 mt-0.5">
                                                {rAuthorPhoto
                                                    ? <img src={rAuthorPhoto} alt={rAuthorName} className="w-full h-full object-cover" />
                                                    : <span className="text-white font-black text-[9px]">{getInitials(rAuthorName)}</span>
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0 bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2">
                                                <div className="flex items-baseline gap-2 mb-0.5">
                                                    <span className="text-xs font-black text-slate-200">{rAuthorName}</span>
                                                    {rAuthorRole && <span className="text-[8px] text-church-blue-400 font-black uppercase tracking-wider">{rAuthorRole}</span>}
                                                    <span className="text-[8px] text-slate-600 ml-auto">{timeAgo(reply.created_at)}</span>
                                                </div>
                                                <p className="text-xs text-slate-400 leading-relaxed">{reply.message}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Reply input */}
                            <form onSubmit={handleSendReply} className="flex items-center gap-2 pt-1">
                                <input
                                    type="text"
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                    placeholder="Write a reply..."
                                    className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-church-blue-500/40 placeholder:text-slate-600 transition-colors font-medium"
                                />
                                <button
                                    type="submit"
                                    disabled={sendingReply || !replyText.trim()}
                                    className="w-8 h-8 rounded-xl bg-gradient-church flex items-center justify-center text-white disabled:opacity-30 active:scale-90 transition-all shrink-0"
                                >
                                    {sendingReply ? <Loader2 className="animate-spin" size={12} /> : <Send size={12} />}
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
