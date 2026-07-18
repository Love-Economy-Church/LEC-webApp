import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Loader2, Megaphone, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Map of position level → target audience options they can choose
const AUDIENCE_OPTIONS_BY_LEVEL = {
    1: [ // Branch Pastor
        { value: 'all', label: 'Everyone' },
        { value: 'church_heads', label: 'Church Heads only' },
        { value: 'mc_heads', label: 'MC Heads only' },
        { value: 'buscenta_heads', label: 'Buscenta Heads only' },
        { value: 'cell_shepherds', label: 'Cell Shepherds only' },
    ],
    2: [ // Church Head
        { value: 'all', label: 'Everyone' },
        { value: 'mc_heads', label: 'MC Heads only' },
        { value: 'buscenta_heads', label: 'Buscenta Heads only' },
        { value: 'cell_shepherds', label: 'Cell Shepherds only' },
    ],
    3: [ // MC Head
        { value: 'all', label: 'Everyone in my MC' },
        { value: 'buscenta_heads', label: 'Buscenta Heads only' },
        { value: 'cell_shepherds', label: 'Cell Shepherds only' },
    ],
    4: [ // Buscenta Head
        { value: 'all', label: 'Everyone in my Buscenta' },
        { value: 'cell_shepherds', label: 'Cell Shepherds only' },
    ],
    5: [ // Cell Shepherd
        { value: 'all', label: 'My Cell Members' },
    ],
};

export default function PostAnnouncementModal({ onClose, onPosted, userRole }) {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [audience, setAudience] = useState('all');
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState('');

    const level = userRole?.level || 6;
    const audienceOptions = AUDIENCE_OPTIONS_BY_LEVEL[level] || [{ value: 'all', label: 'Everyone' }];

    const handlePost = async (e) => {
        e.preventDefault();
        if (!title.trim() || !body.trim()) { setError('Please fill in the title and message.'); return; }
        if (!userRole?.personId || !userRole?.unitId) { setError('Could not determine your identity.'); return; }
        setPosting(true);
        setError('');
        try {
            const { error: insertErr } = await supabase.from('announcements').insert([{
                author_id: userRole.personId,
                unit_id: userRole.unitId,
                title: title.trim(),
                body: body.trim(),
                target_audience: audience,
            }]);
            if (insertErr) throw insertErr;
            onPosted?.();
            onClose();
        } catch (err) {
            console.error('PostAnnouncement error:', err);
            setError(err.message || 'Failed to post announcement.');
        } finally {
            setPosting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9000] flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 60 }}
                transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                className="relative w-full md:max-w-lg bg-[#0d1322] border border-white/[0.07] rounded-t-3xl md:rounded-3xl shadow-2xl z-10 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.05]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-church-blue-500/10 border border-church-blue-500/20 flex items-center justify-center">
                            <Megaphone size={18} className="text-church-blue-400" />
                        </div>
                        <div>
                            <h2 className="font-black text-white text-base">New Announcement</h2>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                Posting as {userRole?.positionTitle} · {userRole?.unitName}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handlePost} className="px-6 py-5 space-y-4">
                    {/* Audience Selector */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Send To</label>
                        <div className="relative">
                            <select
                                value={audience}
                                onChange={e => setAudience(e.target.value)}
                                className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 font-semibold focus:outline-none focus:border-church-blue-500/40 transition-colors pr-10"
                            >
                                {audienceOptions.map(opt => (
                                    <option key={opt.value} value={opt.value} className="bg-[#0d1322]">{opt.label}</option>
                                ))}
                            </select>
                            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Sunday Service Reminder"
                            maxLength={120}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 font-semibold focus:outline-none focus:border-church-blue-500/40 placeholder:text-slate-600 transition-colors"
                        />
                    </div>

                    {/* Body */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Message</label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Write your announcement here..."
                            rows={4}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 font-medium focus:outline-none focus:border-church-blue-500/40 placeholder:text-slate-600 transition-colors resize-none leading-relaxed"
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-red-400 font-semibold bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={posting || !title.trim() || !body.trim()}
                        className="w-full py-3.5 bg-gradient-church text-white font-black text-sm uppercase tracking-widest rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-[.98] transition-all shadow-lg shadow-church-blue-900/30 flex items-center justify-center gap-2"
                    >
                        {posting ? <Loader2 className="animate-spin" size={16} /> : <Megaphone size={16} />}
                        {posting ? 'Posting...' : 'Post Announcement'}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
