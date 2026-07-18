import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from 'react-router-dom';
import { Search, Plus, X, Send, Loader2, MessageSquare, User, UserCircle2, ArrowLeft } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useUnreadMessages } from '../hooks/useUnreadMessages';

export default function ChatsPage() {
    const { userRole } = useAuth();
    const { markAsRead } = useUnreadMessages();
    const location = useLocation();

    // Mark messages as read when chats page is opened
    useEffect(() => {
        if (userRole?.personId) markAsRead();
    }, [userRole?.personId, markAsRead]);

    // Auto-open a chat if navigated here with a target user (e.g. from Birthday "Send Wishes")
    useEffect(() => {
        if (location.state?.openChatWith) {
            const target = location.state.openChatWith;
            handleOpenChat({
                id: target.id,
                name: target.full_name,
                photo: target.photo_url,
                role: target.position_title || '',
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state?.openChatWith?.id]);

    const [chats, setChats] = useState([]);
    const [chatsLoading, setChatsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChatUser, setSelectedChatUser] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [sendingMsg, setSendingMsg] = useState(false);
    const [showNewChatList, setShowNewChatList] = useState(false);
    const [leaders, setLeaders] = useState([]);
    const [newChatSearch, setNewChatSearch] = useState('');
    const chatEndRef = useRef(null);

    // Auto-scroll to bottom when messages update
    useEffect(() => {
        if (selectedChatUser && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, selectedChatUser]);

    // Fetch inbox list
    const fetchActiveChats = useCallback(async (silent = false) => {
        if (!userRole?.personId) return;
        if (!silent) setChatsLoading(true);
        try {
            const { data, error } = await supabase
                .from('private_messages')
                .select('id, message, created_at, sender_id, recipient_id')
                .or(`sender_id.eq.${userRole.personId},recipient_id.eq.${userRole.personId}`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const otherIds = Array.from(new Set(
                data.map(m => m.sender_id === userRole.personId ? m.recipient_id : m.sender_id)
            ));

            if (otherIds.length === 0) { setChats([]); return; }

            const { data: peopleData, error: peopleError } = await supabase
                .from('people')
                .select('id, full_name, photo_url, assignments:position_assignments(position:positions(title))')
                .in('id', otherIds);

            if (peopleError) throw peopleError;

            const chatsMap = new Map();
            data.forEach(msg => {
                const otherId = msg.sender_id === userRole.personId ? msg.recipient_id : msg.sender_id;
                const person = peopleData.find(p => p.id === otherId);
                if (!person) return;
                const role = person.assignments?.find(a => a.position)?.position?.title || '';
                if (!chatsMap.has(otherId)) {
                    chatsMap.set(otherId, {
                        user: { id: person.id, name: person.full_name, photo: person.photo_url, role },
                        latestMessage: msg.message,
                        time: new Date(msg.created_at),
                        isMine: msg.sender_id === userRole.personId,
                    });
                }
            });
            setChats(Array.from(chatsMap.values()));
        } catch (err) {
            console.error('fetchActiveChats error:', err);
        } finally {
            if (!silent) setChatsLoading(false);
        }
    }, [userRole?.personId]);

    // Open a conversation thread
    const handleOpenChat = useCallback(async (otherUser, silent = false) => {
        setSelectedChatUser(otherUser);
        if (!silent) setChatsLoading(true);
        try {
            const { data, error } = await supabase
                .from('private_messages')
                .select('*')
                .or(`and(sender_id.eq.${userRole.personId},recipient_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},recipient_id.eq.${userRole.personId})`)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setChatMessages(data || []);
        } catch (err) {
            console.error('handleOpenChat error:', err);
        } finally {
            if (!silent) setChatsLoading(false);
        }
    }, [userRole?.personId]);

    // Send message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !userRole || !selectedChatUser) return;
        const text = chatInput.trim();
        setChatInput('');
        setSendingMsg(true);
        try {
            const { data, error } = await supabase
                .from('private_messages')
                .insert([{ sender_id: userRole.personId, recipient_id: selectedChatUser.id, message: text }])
                .select().single();
            if (error) throw error;
            setChatMessages(prev => [...prev, data]);
            fetchActiveChats(true);
        } catch (err) {
            console.error('handleSendMessage error:', err);
        } finally {
            setSendingMsg(false);
        }
    };

    // Open "New Chat" modal — fetch all members
    const handleOpenNewChat = async () => {
        setShowNewChatList(true);
        try {
            const { data, error } = await supabase
                .from('people')
                .select('id, full_name, photo_url, assignments:position_assignments(position:positions(title, level))')
                .eq('is_active', true)
                .eq('is_placeholder', false);

            if (error) throw error;

            const list = (data || [])
                .filter(p => p.id !== userRole.personId && p.assignments?.find(a => a.position))
                .map(p => {
                    const a = p.assignments.find(a => a.position);
                    return { id: p.id, name: p.full_name, photo: p.photo_url, role: a.position.title, level: a.position.level };
                })
                .sort((a, b) => (a.level || 99) - (b.level || 99));

            setLeaders(list);
        } catch (err) {
            console.error('handleOpenNewChat error:', err);
        }
    };

    // Polling + mount
    useEffect(() => {
        if (!userRole?.personId) return;
        fetchActiveChats(false);
        const interval = setInterval(() => fetchActiveChats(true), 6000);
        return () => clearInterval(interval);
    }, [userRole?.personId, fetchActiveChats]);

    // Real-time listener for active thread
    useEffect(() => {
        if (!userRole?.personId || !selectedChatUser) return;

        const ch = supabase.channel(`chats-thread-${selectedChatUser.id}-${userRole.personId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' }, ({ new: m }) => {
                if (
                    (m.sender_id === userRole.personId && m.recipient_id === selectedChatUser.id) ||
                    (m.sender_id === selectedChatUser.id && m.recipient_id === userRole.personId)
                ) {
                    setChatMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
                    fetchActiveChats(true);
                }
            }).subscribe();

        const poll = setInterval(() => handleOpenChat(selectedChatUser, true), 4000);
        return () => { supabase.removeChannel(ch); clearInterval(poll); };
    }, [selectedChatUser?.id, userRole?.personId, handleOpenChat, fetchActiveChats]);

    const filteredChats = chats.filter(c =>
        c.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.user.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredLeaders = leaders.filter(l =>
        l.name.toLowerCase().includes(newChatSearch.toLowerCase()) ||
        l.role.toLowerCase().includes(newChatSearch.toLowerCase())
    );

    const getInitials = (name = '') => name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();

    // Avatar component
    const Avatar = ({ photo, name, size = 'md' }) => {
        const dim = size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-12 h-12' : 'w-11 h-11';
        return (
            <div className={`${dim} rounded-2xl bg-gradient-to-br from-church-blue-700 to-slate-800 overflow-hidden flex items-center justify-center shrink-0 border border-white/10`}>
                {photo
                    ? <img src={photo} alt={name} className="w-full h-full object-cover" />
                    : <span className="text-white font-black text-xs tracking-wider">{getInitials(name)}</span>
                }
            </div>
        );
    };

    return (
        <div className="fixed inset-0 top-14 md:top-16 bottom-16 md:bottom-0 bg-[#020617] text-gray-100 flex overflow-hidden">

            {/* ── Inbox Sidebar ─────────────────────────────────────────────── */}
            <div className={`flex flex-col w-full md:w-[340px] md:border-r md:border-white/[0.05] shrink-0 ${selectedChatUser ? 'hidden md:flex' : 'flex'}`}>
                
                {/* Sidebar Header */}
                <div className="px-5 pt-5 pb-3 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-black text-white leading-tight">
                            Direct <span className="text-church-blue-400">Chats</span>
                        </h1>
                        <button
                            onClick={handleOpenNewChat}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-church text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-church-blue-500/20 active:scale-95 transition-transform"
                        >
                            <Plus size={14} />
                            New Chat
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-church-blue-500/40 placeholder:text-slate-600 transition-colors"
                        />
                    </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 space-y-0.5">
                    {chatsLoading && chats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="animate-spin text-church-blue-500" size={22} />
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Loading...</span>
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 px-8 text-center">
                            <MessageSquare size={36} className="text-slate-800" strokeWidth={1.5} />
                            <p className="font-bold text-slate-400 text-sm">No Conversations Yet</p>
                            <p className="text-xs text-slate-600 leading-relaxed">Tap "New Chat" to start a private message with any member.</p>
                        </div>
                    ) : (
                        filteredChats.map(chat => (
                            <button
                                key={chat.user.id}
                                onClick={() => handleOpenChat(chat.user)}
                                className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-all text-left ${
                                    selectedChatUser?.id === chat.user.id
                                        ? 'bg-church-blue-500/10 border border-church-blue-500/20'
                                        : 'border border-transparent hover:bg-white/[0.03]'
                                }`}
                            >
                                <Avatar photo={chat.user.photo} name={chat.user.name} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="font-bold text-slate-100 text-sm leading-tight truncate">{chat.user.name}</span>
                                        <span className="text-[9px] text-slate-500 font-semibold shrink-0">
                                            {chat.time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    {chat.user.role && (
                                        <p className="text-[9px] text-church-blue-400 font-black uppercase tracking-wider leading-none mt-0.5">{chat.user.role}</p>
                                    )}
                                    <p className="text-slate-500 text-xs truncate mt-1 leading-tight font-medium">
                                        {chat.isMine ? <span className="text-slate-600">You: </span> : ''}{chat.latestMessage}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* ── Chat Thread ───────────────────────────────────────────────── */}
            <div className={`flex-1 flex flex-col overflow-hidden ${!selectedChatUser ? 'hidden md:flex' : 'flex'}`}>
                {selectedChatUser ? (
                    <>
                        {/* Thread Header */}
                        <div className="px-4 py-3.5 border-b border-white/[0.05] bg-[#020617] flex items-center gap-3 shrink-0">
                            <button
                                onClick={() => setSelectedChatUser(null)}
                                className="md:hidden p-2 -ml-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <Avatar photo={selectedChatUser.photo} name={selectedChatUser.name} size="sm" />
                            <div className="flex-1 min-w-0">
                                <h3 className="font-black text-white text-base leading-tight truncate">{selectedChatUser.name}</h3>
                                {selectedChatUser.role && (
                                    <p className="text-[9px] text-church-blue-400 font-black uppercase tracking-widest leading-none mt-0.5">{selectedChatUser.role}</p>
                                )}
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-2 min-h-0">
                            {chatMessages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-center opacity-60">
                                    <MessageSquare size={36} className="text-slate-700" strokeWidth={1.5} />
                                    <p className="text-xs text-slate-500">Send the first message to {selectedChatUser.name.split(' ')[0]}</p>
                                </div>
                            )}
                            {chatMessages.map((msg, i) => {
                                const isMe = msg.sender_id === userRole?.personId;
                                return (
                                    <div key={msg.id || i} className={`flex flex-col max-w-[76%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                            isMe
                                                ? 'bg-gradient-church text-white rounded-br-sm shadow-md shadow-church-blue-900/30'
                                                : 'bg-slate-900 text-slate-100 rounded-bl-sm border border-white/[0.06]'
                                        }`}>
                                            <p className="whitespace-pre-wrap">{msg.message}</p>
                                        </div>
                                        <span className="text-[9px] text-slate-600 mt-1 px-1 font-semibold">
                                            {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Message Input */}
                        <form onSubmit={handleSendMessage} className="px-4 py-3 border-t border-white/[0.05] bg-[#020617] flex items-center gap-2 shrink-0">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                placeholder={`Message ${selectedChatUser.name.split(' ')[0]}...`}
                                disabled={sendingMsg}
                                className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-church-blue-500/40 transition-colors text-slate-200 placeholder:text-slate-600 font-medium"
                            />
                            <button
                                type="submit"
                                disabled={sendingMsg || !chatInput.trim()}
                                className="w-11 h-11 rounded-2xl bg-gradient-church hover:opacity-90 disabled:opacity-30 text-white flex items-center justify-center shadow-lg transition-all active:scale-95 shrink-0"
                            >
                                {sendingMsg ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10">
                        <div className="w-16 h-16 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                            <MessageSquare size={28} className="text-slate-700" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-400 text-sm">Select a Conversation</h3>
                            <p className="text-xs text-slate-600 mt-1 max-w-xs leading-relaxed">Choose a chat on the left or tap "New Chat" to message someone.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── New Chat Modal ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {showNewChatList && (
                    <div className="fixed inset-0 z-[10000] bg-[#020617]/98 backdrop-blur-sm flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] shrink-0">
                            <div>
                                <h2 className="font-black text-white text-base">New Conversation</h2>
                                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Select a member to message</p>
                            </div>
                            <button
                                onClick={() => { setShowNewChatList(false); setNewChatSearch(''); }}
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-5 py-3 border-b border-white/[0.04] shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                                <input
                                    type="text"
                                    placeholder="Search by name or title..."
                                    value={newChatSearch}
                                    onChange={e => setNewChatSearch(e.target.value)}
                                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-church-blue-500/40 placeholder:text-slate-600 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-1">
                            {leaders.length === 0 ? (
                                <div className="flex justify-center py-16">
                                    <Loader2 className="animate-spin text-church-blue-500" size={24} />
                                </div>
                            ) : filteredLeaders.length === 0 ? (
                                <p className="text-center text-slate-600 text-sm py-16">No results for "{newChatSearch}"</p>
                            ) : (
                                filteredLeaders.map(l => (
                                    <button
                                        key={l.id}
                                        onClick={() => { setShowNewChatList(false); setNewChatSearch(''); handleOpenChat(l); }}
                                        className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] cursor-pointer transition-all text-left"
                                    >
                                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-church-blue-700 to-slate-800 overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                                            {l.photo
                                                ? <img src={l.photo} alt={l.name} className="w-full h-full object-cover" />
                                                : <span className="text-white font-black text-xs">{getInitials(l.name)}</span>
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-100 text-sm leading-tight truncate">{l.name}</p>
                                            <p className="text-[9px] text-church-blue-400 font-black uppercase tracking-wider leading-none mt-0.5">{l.role}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
