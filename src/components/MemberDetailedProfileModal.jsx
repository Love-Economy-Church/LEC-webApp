import { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, User, Phone, Calendar, Mail, Globe, Shield,
    MessageSquare, BarChart3, Send, CheckCircle2, AlertCircle,
    Loader2, TrendingUp, TrendingDown, Minus, Users, Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    Tooltip, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';

// ─── helpers ────────────────────────────────────────────────────────────────

function getAge(dobString) {
    if (!dobString) return null;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
}

function isUnitHead(person) {
    const memberTitles = ['Member', 'Cell Member', 'First Timer', 'Unassigned', 'Brethren'];
    return person?.role && !memberTitles.includes(person.role);
}

function groupMessagesByDate(messages) {
    const groups = [];
    let lastDate = null;
    messages.forEach(msg => {
        const d = new Date(msg.created_at).toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        if (d !== lastDate) {
            groups.push({ type: 'date', label: d });
            lastDate = d;
        }
        groups.push({ type: 'message', ...msg });
    });
    return groups;
}

// ─── custom tooltip for charts ──────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 shadow-2xl text-xs">
            <p className="text-slate-400 font-bold mb-1">{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color }} className="font-black">
                    {p.name}: {typeof p.value === 'number' ? `${p.value}${p.name.includes('%') || p.name === 'Attendance' ? '%' : ''}` : p.value === 100 ? 'Present ✓' : 'Absent ✗'}
                </p>
            ))}
        </div>
    );
};

// ─── radial gauge for attendance rate ───────────────────────────────────────

function AttendanceGauge({ rate, label, color }) {
    const data = [{ value: rate, fill: color }];
    return (
        <div className="flex flex-col items-center">
            <div className="relative w-28 h-28">
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                        cx="50%" cy="50%"
                        innerRadius="65%" outerRadius="95%"
                        data={data} startAngle={220} endAngle={-40}
                    >
                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                        <RadialBar
                            dataKey="value"
                            cornerRadius={8}
                            background={{ fill: '#1e293b' }}
                        />
                    </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{rate}%</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                </div>
            </div>
        </div>
    );
}

// ─── stat badge ─────────────────────────────────────────────────────────────

function StatBadge({ label, value, icon, colorClass }) {
    return (
        <div className={`flex-1 flex flex-col items-center justify-center py-3 px-2 rounded-2xl border ${colorClass} text-center`}>
            <div className="mb-1 opacity-70">{icon}</div>
            <span className="text-xl font-black text-white">{value}</span>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-0.5">{label}</span>
        </div>
    );
}

// ─── info item ───────────────────────────────────────────────────────────────

function InfoItem({ icon, label, value, accent = 'blue' }) {
    const accents = {
        blue: 'bg-church-blue-500/10 text-church-blue-400',
        emerald: 'bg-emerald-500/10 text-emerald-400',
        amber: 'bg-amber-500/10 text-amber-400',
        violet: 'bg-violet-500/10 text-violet-400',
    };
    return (
        <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accents[accent]}`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">{label}</p>
                <p className="text-sm font-semibold text-slate-200 mt-0.5 truncate">{value || '—'}</p>
            </div>
        </div>
    );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function MemberDetailedProfileModal({ isOpen, onClose, person, onEditClick }) {
    const { userRole } = useAuth();
    const [activeTab, setActiveTab] = useState('info');

    // personal attendance
    const [personalAttendance, setPersonalAttendance] = useState([]);
    const [personalRate, setPersonalRate] = useState(0);
    const [attendanceLoading, setAttendanceLoading] = useState(false);

    // unit attendance
    const [unitAttendance, setUnitAttendance] = useState([]);
    const [unitStats, setUnitStats] = useState({ size: 0, avgRate: 0 });
    const [unitLoading, setUnitLoading] = useState(false);

    // chat
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [chatSending, setChatSending] = useState(false);
    const [chatError, setChatError] = useState('');
    const chatEndRef = useRef(null);

    const leader = person ? isUnitHead(person) : false;

    // reset tabs when person changes
    useEffect(() => {
        setActiveTab('info');
        setPersonalAttendance([]);
        setUnitAttendance([]);
        setMessages([]);
    }, [person?.id]);

    // fetch data on tab change
    useEffect(() => {
        if (!person || !isOpen) return;
        if (activeTab === 'attendance') fetchPersonalAttendance();
        else if (activeTab === 'unit' && leader) fetchUnitAnalytics();
        else if (activeTab === 'chat') {
            fetchPrivateMessages();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, person?.id, isOpen]);

    // real-time chat subscription
    useEffect(() => {
        if (!isOpen || activeTab !== 'chat' || !userRole?.personId || !person?.id) return;
        const channel = supabase
            .channel(`drawer-chat-${person.id}-${userRole.personId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' }, (payload) => {
                const m = payload.new;
                if (
                    (m.sender_id === userRole.personId && m.recipient_id === person.id) ||
                    (m.sender_id === person.id && m.recipient_id === userRole.personId)
                ) {
                    setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
                }
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [isOpen, activeTab, person?.id, userRole?.personId]);

    // scroll chat to bottom
    useEffect(() => {
        if (activeTab === 'chat' && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, activeTab]);

    // ── data fetching ─────────────────────────────────────────────────────────

    const fetchPersonalAttendance = useCallback(async () => {
        if (!person?.id) return;
        setAttendanceLoading(true);
        try {
            const { data, error } = await supabase
                .from('attendance_records')
                .select('status, session:attendance_sessions(session_date)')
                .eq('person_id', person.id);

            if (error) throw error;
            const records = (data || [])
                .filter(r => r.session)
                .sort((a, b) => new Date(a.session.session_date) - new Date(b.session.session_date));

            setPersonalAttendance(records);
            const presentCount = records.filter(r => r.status === 'PRESENT').length;
            setPersonalRate(records.length ? Math.round((presentCount / records.length) * 100) : 0);
        } catch (err) {
            console.error('Error loading personal attendance:', err);
        } finally {
            setAttendanceLoading(false);
        }
    }, [person?.id]);

    const fetchUnitAnalytics = useCallback(async () => {
        if (!person?.unit_id) return;
        setUnitLoading(true);
        try {
            const [{ data: members }, { data: trend }] = await Promise.all([
                supabase.from('position_assignments').select('person_id', { count: 'exact' })
                    .eq('unit_id', person.unit_id).eq('is_active', true),
                supabase.from('attendance_analytics_view').select('*')
                    .eq('unit_id', person.unit_id)
                    .order('session_date', { ascending: true }).limit(8)
            ]);

            const trendData = trend || [];
            setUnitAttendance(trendData);
            const avgRate = trendData.length
                ? Math.round(trendData.reduce((s, r) => s + (r.attendance_rate || 0), 0) / trendData.length)
                : 0;
            setUnitStats({ size: members?.length ?? 0, avgRate });
        } catch (err) {
            console.error('Error loading unit analytics:', err);
        } finally {
            setUnitLoading(false);
        }
    }, [person?.unit_id]);

    const fetchPrivateMessages = useCallback(async () => {
        if (!userRole?.personId || !person?.id) return;
        setChatLoading(true);
        setChatError('');
        try {
            const { data, error } = await supabase
                .from('private_messages')
                .select('*')
                .or(`and(sender_id.eq.${userRole.personId},recipient_id.eq.${person.id}),and(sender_id.eq.${person.id},recipient_id.eq.${userRole.personId})`)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Error loading messages:', err);
            setChatError('Failed to load chat history.');
        } finally {
            setChatLoading(false);
        }
    }, [userRole?.personId, person?.id]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text || !userRole?.personId || !person?.id) return;
        setNewMessage('');
        setChatSending(true);
        try {
            const { data, error } = await supabase
                .from('private_messages')
                .insert([{ sender_id: userRole.personId, recipient_id: person.id, message: text }])
                .select().single();
            if (error) throw error;
            setMessages(prev => [...prev, data]);
        } catch (err) {
            setChatError('Message failed to send.');
            setNewMessage(text); // restore input
        } finally {
            setChatSending(false);
        }
    };

    if (!person || !isOpen) return null;

    // ── derived chart data ────────────────────────────────────────────────────

    const attendanceChartData = personalAttendance.slice(-10).map(r => ({
        date: new Date(r.session.session_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        Present: r.status === 'PRESENT' ? 100 : 0,
    }));

    const unitChartData = unitAttendance.map(s => ({
        date: new Date(s.session_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        Attendance: Math.round(s.attendance_rate || 0),
        Present: s.total_present,
        Total: s.total_marked,
    }));

    const presentCount = personalAttendance.filter(r => r.status === 'PRESENT').length;
    const absentCount = personalAttendance.length - presentCount;

    // trend: compare last 3 vs prior 3
    const trend = (() => {
        if (personalAttendance.length < 4) return 'neutral';
        const recent = personalAttendance.slice(-3).filter(r => r.status === 'PRESENT').length;
        const prior = personalAttendance.slice(-6, -3).filter(r => r.status === 'PRESENT').length;
        if (recent > prior) return 'up';
        if (recent < prior) return 'down';
        return 'neutral';
    })();

    const grouped = groupMessagesByDate(messages);

    const tabs = [
        { id: 'info', label: 'Info', icon: <User size={13} /> },
        { id: 'attendance', label: 'Analytics', icon: <BarChart3 size={13} /> },
        ...(leader ? [{ id: 'unit', label: 'Unit', icon: <Users size={13} /> }] : []),
        { id: 'chat', label: 'Message', icon: <MessageSquare size={13} /> },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    {/* Dim backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 240, mass: 0.8 }}
                        className="relative z-10 w-full max-w-md h-full bg-[#030712] border-l border-white/[0.07] shadow-[−4px_0_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-gray-100"
                    >
                        {/* ── hero header ─────────────────────────────────────────── */}
                        <div className="relative overflow-hidden shrink-0">
                            {/* gradient glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-church-blue-900/40 via-transparent to-violet-900/20 pointer-events-none" />
                            <div className="absolute top-0 right-0 w-48 h-48 bg-church-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                            <div className="relative p-5 flex items-start gap-4">
                                {/* avatar */}
                                <div className="relative shrink-0">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-white/10 overflow-hidden shadow-xl flex items-center justify-center">
                                        {person.photo
                                            ? <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                                            : <User size={28} className="text-slate-500" />
                                        }
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#030712] rounded-full shadow" />
                                </div>

                                {/* name & meta */}
                                <div className="flex-1 min-w-0 pt-0.5">
                                    <h2 className="text-lg font-black text-white leading-tight truncate">{person.name}</h2>
                                    <p className="text-church-blue-400 font-black text-[10px] uppercase tracking-widest mt-0.5">{person.role}</p>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-400">
                                            {person.unit}
                                        </span>
                                    </div>
                                </div>

                                {/* close */}
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 shrink-0 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-white/5 hover:border-white/10"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* ── tab bar ─────────────────────────────────────────────── */}
                            <div className="flex gap-1 px-4 pb-3">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                                            activeTab === tab.id
                                                ? 'bg-church-blue-600 text-white shadow-lg shadow-church-blue-900/50'
                                                : 'bg-white/[0.04] text-slate-500 hover:text-slate-300 hover:bg-white/[0.07]'
                                        }`}
                                    >
                                        {tab.icon}
                                        <span className="hidden sm:inline">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* divider */}
                        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent shrink-0" />

                        {/* ── scrollable content ──────────────────────────────────────── */}
                        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                            <AnimatePresence mode="wait">

                                {/* ─── INFO TAB ──────────────────────────────────────────── */}
                                {activeTab === 'info' && (
                                    <motion.div
                                        key="info"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.18 }}
                                        className="p-5 space-y-5"
                                    >
                                        {/* Contact card */}
                                        <div className="bg-slate-900/60 border border-white/[0.06] rounded-2xl p-4 space-y-3.5">
                                            <div className="flex justify-between items-center pb-1 border-b border-white/[0.05]">
                                                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Contact Details</h3>
                                                <button
                                                    onClick={() => onEditClick(person)}
                                                    className="text-[10px] font-black text-church-blue-400 hover:text-church-blue-300 transition-colors uppercase tracking-wider"
                                                >
                                                    Edit →
                                                </button>
                                            </div>
                                            <InfoItem icon={<Phone size={14} />} label="Telephone" value={person.phone} accent="blue" />
                                            <InfoItem icon={<Calendar size={14} />} label="Date of Birth"
                                                value={person.dob ? new Date(person.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null}
                                                accent="violet"
                                            />
                                            <InfoItem icon={<User size={14} />} label="Age"
                                                value={getAge(person.dob) != null ? `${getAge(person.dob)} years old` : null}
                                                accent="violet"
                                            />
                                            <InfoItem icon={<Globe size={14} />} label="Social Handle"
                                                value={person.socialHandle ? `@${person.socialHandle.replace('@', '')}` : null}
                                                accent="emerald"
                                            />
                                        </div>

                                        {/* Church placement card */}
                                        <div className="bg-slate-900/60 border border-white/[0.06] rounded-2xl p-4 space-y-3.5">
                                            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 pb-1 border-b border-white/[0.05]">Church Placement</h3>
                                            <InfoItem icon={<Shield size={14} />} label="Position" value={person.role} accent="blue" />
                                            <InfoItem icon={<CheckCircle2 size={14} />} label="Unit" value={person.unit} accent="emerald" />
                                            <InfoItem icon={<Mail size={14} />} label="System Email" value={person.email} accent="amber" />
                                        </div>

                                        {/* Quick chat CTA */}
                                        <button
                                            onClick={() => setActiveTab('chat')}
                                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-church-blue-700 to-church-blue-600 hover:from-church-blue-600 hover:to-church-blue-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-church-blue-900/40 transition-all active:scale-[0.98]"
                                        >
                                            <MessageSquare size={16} />
                                            Send Private Message
                                        </button>
                                    </motion.div>
                                )}

                                {/* ─── ATTENDANCE TAB ─────────────────────────────────────── */}
                                {activeTab === 'attendance' && (
                                    <motion.div
                                        key="attendance"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.18 }}
                                        className="p-5 space-y-5"
                                    >
                                        {attendanceLoading ? (
                                            <LoadingSpinner label="Loading attendance..." />
                                        ) : personalAttendance.length === 0 ? (
                                            <EmptyState icon={<BarChart3 size={28} />} message="No attendance records found for this member." />
                                        ) : (
                                            <>
                                                {/* Gauge + stats row */}
                                                <div className="flex items-center justify-between gap-3">
                                                    <AttendanceGauge
                                                        rate={personalRate}
                                                        label="Attendance"
                                                        color={personalRate >= 70 ? '#10b981' : personalRate >= 40 ? '#f59e0b' : '#ef4444'}
                                                    />
                                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                                        <StatBadge
                                                            label="Present"
                                                            value={presentCount}
                                                            icon={<CheckCircle2 size={14} />}
                                                            colorClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                        />
                                                        <StatBadge
                                                            label="Absent"
                                                            value={absentCount}
                                                            icon={<AlertCircle size={14} />}
                                                            colorClass="bg-red-500/10 border-red-500/20 text-red-400"
                                                        />
                                                        <StatBadge
                                                            label="Sessions"
                                                            value={personalAttendance.length}
                                                            icon={<Award size={14} />}
                                                            colorClass="bg-white/5 border-white/10 text-slate-400"
                                                        />
                                                        <div className={`flex-1 flex flex-col items-center justify-center py-3 px-2 rounded-2xl border text-center ${
                                                            trend === 'up' ? 'bg-emerald-500/10 border-emerald-500/20' :
                                                            trend === 'down' ? 'bg-red-500/10 border-red-500/20' :
                                                            'bg-white/5 border-white/10'
                                                        }`}>
                                                            <div className="mb-1">
                                                                {trend === 'up' ? <TrendingUp size={14} className="text-emerald-400" /> :
                                                                 trend === 'down' ? <TrendingDown size={14} className="text-red-400" /> :
                                                                 <Minus size={14} className="text-slate-400" />}
                                                            </div>
                                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Trend</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Area chart */}
                                                {attendanceChartData.length > 1 && (
                                                    <div className="bg-slate-900/60 border border-white/[0.06] rounded-2xl p-4 space-y-2">
                                                        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Presence History</h3>
                                                        <div className="h-40 w-full">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <AreaChart data={attendanceChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                                                    <defs>
                                                                        <linearGradient id="gPersonal" x1="0" y1="0" x2="0" y2="1">
                                                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                                                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                                        </linearGradient>
                                                                    </defs>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                                                    <XAxis dataKey="date" stroke="#4b5563" fontSize={8} tickLine={false} axisLine={false} />
                                                                    <YAxis domain={[0, 100]} ticks={[0, 100]} stroke="#4b5563" fontSize={8} tickLine={false} axisLine={false}
                                                                        tickFormatter={v => v === 100 ? 'P' : 'A'} />
                                                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3b82f620', strokeWidth: 20, strokeLinecap: 'round' }} />
                                                                    <Area type="monotone" dataKey="Present" stroke="#3b82f6" strokeWidth={2.5}
                                                                        dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                                                                        activeDot={{ r: 5, fill: '#60a5fa', strokeWidth: 0 }}
                                                                        fillOpacity={1} fill="url(#gPersonal)" />
                                                                </AreaChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Recent list */}
                                                <div className="space-y-1.5">
                                                    <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-1">Recent Sessions</h3>
                                                    {personalAttendance.slice(-5).reverse().map((r, i) => (
                                                        <div key={i} className="flex justify-between items-center px-4 py-2.5 rounded-xl bg-slate-900/40 border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                                                            <span className="text-sm font-semibold text-slate-300">
                                                                {new Date(r.session.session_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                                                r.status === 'PRESENT'
                                                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                                                    : 'bg-red-500/15 text-red-400 border border-red-500/25'
                                                            }`}>
                                                                {r.status === 'PRESENT' ? '✓ Present' : '✗ Absent'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </motion.div>
                                )}

                                {/* ─── UNIT TAB ───────────────────────────────────────────── */}
                                {activeTab === 'unit' && leader && (
                                    <motion.div
                                        key="unit"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.18 }}
                                        className="p-5 space-y-5"
                                    >
                                        {unitLoading ? (
                                            <LoadingSpinner label="Loading unit stats..." />
                                        ) : (
                                            <>
                                                {/* Unit header */}
                                                <div className="flex items-center gap-3 p-3 bg-slate-900/60 border border-white/[0.06] rounded-2xl">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                                        <Users size={18} className="text-emerald-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Unit Led By</p>
                                                        <p className="font-black text-white">{person.unit}</p>
                                                    </div>
                                                </div>

                                                {/* Gauge + stats */}
                                                <div className="flex items-center justify-between gap-3">
                                                    <AttendanceGauge
                                                        rate={unitStats.avgRate}
                                                        label="Avg Rate"
                                                        color={unitStats.avgRate >= 70 ? '#10b981' : unitStats.avgRate >= 40 ? '#f59e0b' : '#ef4444'}
                                                    />
                                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                                        <StatBadge
                                                            label="Members"
                                                            value={unitStats.size}
                                                            icon={<Users size={14} />}
                                                            colorClass="bg-church-blue-500/10 border-church-blue-500/20 text-church-blue-400"
                                                        />
                                                        <StatBadge
                                                            label="Sessions"
                                                            value={unitAttendance.length}
                                                            icon={<Award size={14} />}
                                                            colorClass="bg-white/5 border-white/10 text-slate-400"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Weekly chart */}
                                                {unitChartData.length > 0 ? (
                                                    <div className="bg-slate-900/60 border border-white/[0.06] rounded-2xl p-4 space-y-2">
                                                        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Weekly Attendance Trend</h3>
                                                        <div className="h-44 w-full">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <AreaChart data={unitChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                                                    <defs>
                                                                        <linearGradient id="gUnit" x1="0" y1="0" x2="0" y2="1">
                                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                                        </linearGradient>
                                                                    </defs>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                                                    <XAxis dataKey="date" stroke="#4b5563" fontSize={8} tickLine={false} axisLine={false} />
                                                                    <YAxis domain={[0, 100]} stroke="#4b5563" fontSize={8} tickLine={false} axisLine={false}
                                                                        tickFormatter={v => `${v}%`} />
                                                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#10b98120', strokeWidth: 20, strokeLinecap: 'round' }} />
                                                                    <Area type="monotone" dataKey="Attendance" stroke="#10b981" strokeWidth={2.5}
                                                                        dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                                                                        activeDot={{ r: 5, fill: '#34d399', strokeWidth: 0 }}
                                                                        fillOpacity={1} fill="url(#gUnit)" />
                                                                </AreaChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <EmptyState icon={<BarChart3 size={28} />} message="No attendance sessions recorded for this unit yet." />
                                                )}

                                                {/* Session breakdown */}
                                                {unitAttendance.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-1">Session Breakdown</h3>
                                                        {unitAttendance.slice().reverse().map((s, i) => (
                                                            <div key={i} className="flex justify-between items-center px-4 py-2.5 rounded-xl bg-slate-900/40 border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                                                                <div>
                                                                    <span className="text-sm font-semibold text-slate-300">
                                                                        {new Date(s.session_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                                    </span>
                                                                    <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                                                                        {s.total_present} present · {s.total_absent} absent
                                                                    </p>
                                                                </div>
                                                                <span className={`text-sm font-black ${Math.round(s.attendance_rate) >= 70 ? 'text-emerald-400' : Math.round(s.attendance_rate) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                                                                    {Math.round(s.attendance_rate || 0)}%
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </motion.div>
                                )}

                                {/* ─── CHAT TAB ───────────────────────────────────────────── */}
                                {activeTab === 'chat' && (
                                    <motion.div
                                        key="chat"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="flex flex-col h-full"
                                        style={{ height: 'calc(100vh - 185px)' }}
                                    >
                                        {/* Private notice banner */}
                                        <div className="mx-4 mt-3 mb-2 px-3 py-2 bg-slate-900/60 border border-white/[0.06] rounded-xl text-[9px] text-slate-400 font-bold flex items-center gap-2 shrink-0">
                                            <Shield size={11} className="text-church-blue-400 shrink-0" />
                                            <span>Private conversation. Only you and {person.name.split(' ')[0]} can see these messages.</span>
                                        </div>

                                        {/* Message feed */}
                                        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar min-h-0">
                                            {chatLoading ? (
                                                <div className="flex items-center justify-center h-full">
                                                    <LoadingSpinner label="Loading messages..." />
                                                </div>
                                            ) : grouped.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                                                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center">
                                                        <MessageSquare size={24} className="text-slate-600" />
                                                    </div>
                                                    <p className="text-slate-400 text-sm font-semibold">Start a private conversation</p>
                                                    <p className="text-slate-600 text-xs max-w-[200px]">Your messages are encrypted and only visible to you and {person.name.split(' ')[0]}.</p>
                                                </div>
                                            ) : (
                                                grouped.map((item, idx) => {
                                                    if (item.type === 'date') {
                                                        return (
                                                            <div key={idx} className="flex items-center gap-3 py-3">
                                                                <div className="flex-1 h-px bg-white/[0.06]" />
                                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2">{item.label}</span>
                                                                <div className="flex-1 h-px bg-white/[0.06]" />
                                                            </div>
                                                        );
                                                    }
                                                    const isMe = item.sender_id === userRole?.personId;
                                                    return (
                                                        <div key={item.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                                                            <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                                                    isMe
                                                                        ? 'bg-church-blue-600 text-white rounded-br-sm'
                                                                        : 'bg-slate-800/80 text-slate-100 rounded-bl-sm border border-white/[0.06]'
                                                                }`}>
                                                                    <p className="whitespace-pre-wrap break-words">{item.message}</p>
                                                                </div>
                                                                <span className="text-[8px] text-slate-600 font-bold mt-0.5 px-1">
                                                                    {new Date(item.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                            {chatError && (
                                                <div className="p-3 bg-red-900/40 border border-red-500/20 rounded-xl text-red-300 text-xs font-semibold flex items-center gap-2">
                                                    <AlertCircle size={13} className="shrink-0" />
                                                    {chatError}
                                                </div>
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>

                                        {/* Message input */}
                                        <form
                                            onSubmit={handleSendMessage}
                                            className="shrink-0 flex items-end gap-2 px-4 py-3 border-t border-white/[0.06] bg-[#030712]/80 backdrop-blur-sm"
                                        >
                                            <textarea
                                                value={newMessage}
                                                onChange={e => setNewMessage(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendMessage(e);
                                                    }
                                                }}
                                                rows={1}
                                                placeholder={`Message ${person.name.split(' ')[0]}...`}
                                                disabled={chatSending}
                                                className="flex-1 bg-slate-900/80 border border-slate-700/50 rounded-2xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-church-blue-500/50 focus:ring-1 focus:ring-church-blue-500/30 transition-all resize-none overflow-hidden min-h-[46px] max-h-32"
                                                style={{ lineHeight: '1.5' }}
                                            />
                                            <button
                                                type="submit"
                                                disabled={chatSending || !newMessage.trim()}
                                                className="w-11 h-11 rounded-2xl bg-church-blue-600 hover:bg-church-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-lg shadow-church-blue-900/40 transition-all active:scale-95 shrink-0"
                                            >
                                                {chatSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                            </button>
                                        </form>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function LoadingSpinner({ label }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-church-blue-500" size={24} />
            <span className="text-xs text-slate-500 font-bold">{label}</span>
        </div>
    );
}

function EmptyState({ icon, message }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-700">
                {icon}
            </div>
            <p className="text-slate-500 text-sm font-semibold">{message}</p>
        </div>
    );
}
