import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
    ArrowLeft, UserRound, BarChart2, Users, MessageCircle,
    Phone, Calendar, Globe, Mail, Shield, Send, Loader2,
    CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    Tooltip, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getAge(dob) {
    if (!dob) return null;
    const today = new Date();
    const b = new Date(dob);
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
    return age;
}

function groupByDate(messages) {
    const out = [];
    let last = null;
    messages.forEach(msg => {
        const d = new Date(msg.created_at).toLocaleDateString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric'
        });
        if (d !== last) { out.push({ type: 'date', label: d }); last = d; }
        out.push({ type: 'msg', ...msg });
    });
    return out;
}

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#0a0f1e] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-2xl">
            <p className="text-slate-400 font-semibold mb-0.5">{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color }} className="font-bold">{p.name}: {p.value}%</p>
            ))}
        </div>
    );
};

// ─── radial gauge ─────────────────────────────────────────────────────────────
function AttendanceGauge({ rate }) {
    const color = rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444';
    return (
        <div className="relative w-24 h-24 mx-auto">
            <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="68%" outerRadius="95%"
                    data={[{ value: rate, fill: color }]} startAngle={220} endAngle={-40}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#1e293b' }} />
                </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-white">{rate}%</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">rate</span>
            </div>
        </div>
    );
}

// ─── TABS definition ──────────────────────────────────────────────────────────
const TABS = [
    { id: 'info',       label: 'Info',      Icon: UserRound },
    { id: 'analytics',  label: 'Analytics', Icon: BarChart2 },
    { id: 'unit',       label: 'Unit',      Icon: Users },
    { id: 'chat',       label: 'Message',   Icon: MessageCircle },
];

// ─── main page ───────────────────────────────────────────────────────────────
export default function MemberProfilePage() {
    const { personId } = useParams();
    const navigate = useNavigate();
    const { userRole } = useAuth();

    const [person, setPerson]               = useState(null);
    const [loading, setLoading]             = useState(true);
    const [activeTab, setActiveTab]         = useState('info');

    // analytics
    const [attendance, setAttendance]       = useState([]);
    const [attendanceRate, setAttendanceRate] = useState(0);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    // unit
    const [unitTrend, setUnitTrend]         = useState([]);
    const [unitStats, setUnitStats]         = useState({ size: 0, avgRate: 0 });
    const [unitLoading, setUnitLoading]     = useState(false);

    // chat
    const [messages, setMessages]           = useState([]);
    const [chatInput, setChatInput]         = useState('');
    const [chatLoading, setChatLoading]     = useState(false);
    const [chatSending, setChatSending]     = useState(false);
    const chatEndRef                         = useRef(null);

    const [schemaNeedsMigration, setSchemaNeedsMigration] = useState(false);

    // ── fetch person ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!personId) return;
        (async () => {
            setLoading(true);
            
            // Try fetching with extended fields
            let { data, error } = await supabase
                .from('people')
                .select(`
                    id, full_name, photo_url, is_placeholder, dob, phone, social_handle,
                    assignments:position_assignments(
                        unit_id,
                        is_primary,
                        position:positions(title, level),
                        unit:organizational_units(id, name)
                    )
                `)
                .eq('id', personId)
                .single();

            // Fallback if columns don't exist
            if (error) {
                console.warn("Retrying query without extended fields due to error:", error.message);
                const fallbackQuery = await supabase
                    .from('people')
                    .select(`
                        id, full_name, photo_url, is_placeholder,
                        assignments:position_assignments(
                            unit_id,
                            is_primary,
                            position:positions(title, level),
                            unit:organizational_units(id, name)
                        )
                    `)
                    .eq('id', personId)
                    .single();

                if (!fallbackQuery.error && fallbackQuery.data) {
                    data = fallbackQuery.data;
                    error = null;
                    setSchemaNeedsMigration(true);
                }
            }

            if (!error && data) {
                const primary = data.assignments?.find(a => a.is_primary && a.position) || data.assignments?.[0];
                setPerson({
                    id: data.id,
                    name: data.full_name,
                    photo: data.photo_url,
                    dob: data.dob || null,
                    phone: data.phone || null,
                    socialHandle: data.social_handle || null,
                    role: primary?.position?.title || 'Member',
                    level: primary?.position?.level ?? 999,
                    unit: primary?.unit?.name || '—',
                    unitId: primary?.unit_id,
                });
            } else {
                console.error("Fetch person failed:", error);
            }
            setLoading(false);
        })();
    }, [personId]);

    // scroll chat
    useEffect(() => {
        if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activeTab]);

    const fetchAttendance = useCallback(async () => {
        if (!person?.id) return;
        setAnalyticsLoading(true);
        try {
            const { data } = await supabase
                .from('attendance_records')
                .select('status, session:attendance_sessions(session_date)')
                .eq('person_id', person.id);
            const records = (data || []).filter(r => r.session)
                .sort((a, b) => new Date(a.session.session_date) - new Date(b.session.session_date));
            setAttendance(records);
            const present = records.filter(r => r.status === 'PRESENT').length;
            setAttendanceRate(records.length ? Math.round((present / records.length) * 100) : 0);
        } finally { setAnalyticsLoading(false); }
    }, [person?.id]);

    const fetchUnitStats = useCallback(async () => {
        if (!person?.unitId) return;
        setUnitLoading(true);
        try {
            const [{ data: members }, { data: trend }] = await Promise.all([
                supabase.from('position_assignments').select('person_id', { count: 'exact' })
                    .eq('unit_id', person.unitId).eq('is_active', true),
                supabase.from('attendance_analytics_view').select('*')
                    .eq('unit_id', person.unitId).order('session_date', { ascending: true }).limit(8)
            ]);
            const trendData = trend || [];
            setUnitTrend(trendData);
            const avgRate = trendData.length
                ? Math.round(trendData.reduce((s, r) => s + (r.attendance_rate || 0), 0) / trendData.length) : 0;
            setUnitStats({ size: members?.length ?? 0, avgRate });
        } finally { setUnitLoading(false); }
    }, [person?.unitId]);

    const fetchMessages = useCallback(async () => {
        if (!userRole?.personId || !person?.id) return;
        setChatLoading(true);
        try {
            const { data, error } = await supabase
                .from('private_messages').select('*')
                .or(`and(sender_id.eq.${userRole.personId},recipient_id.eq.${person.id}),and(sender_id.eq.${person.id},recipient_id.eq.${userRole.personId})`)
                .order('created_at', { ascending: true });
            if (error) {
                console.error("Error fetching messages:", error);
            } else {
                setMessages(data || []);
            }
        } catch (err) {
            console.error("Exception fetching messages:", err);
        } finally { setChatLoading(false); }
    }, [userRole?.personId, person?.id]);

    const sendMessage = async (e) => {
        e.preventDefault();
        const text = chatInput.trim();
        if (!text || !userRole?.personId || !person?.id) return;
        setChatInput('');
        setChatSending(true);
        try {
            const { data, error } = await supabase.from('private_messages')
                .insert([{ sender_id: userRole.personId, recipient_id: person.id, message: text }])
                .select().single();
            if (error) {
                console.error("Error sending message:", error);
                alert(`Failed to send message: ${error.message || error.details}`);
            } else if (data) {
                setMessages(prev => [...prev, data]);
            }
        } catch (err) {
            console.error("Exception sending message:", err);
            alert(`Exception sending message: ${err.message}`);
        } finally { setChatSending(false); }
    };

    // real-time chat
    useEffect(() => {
        if (activeTab !== 'chat' || !userRole?.personId || !person?.id) return;
        const ch = supabase
            .channel(`member-page-chat-${person.id}-${userRole.personId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages' }, ({ new: m }) => {
                if (
                    (m.sender_id === userRole.personId && m.recipient_id === person.id) ||
                    (m.sender_id === person.id && m.recipient_id === userRole.personId)
                ) setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
            })
            .subscribe();

        // Fallback polling: fetch messages every 4 seconds in case Realtime fails
        const interval = setInterval(() => {
            fetchMessages();
        }, 4000);

        return () => {
            supabase.removeChannel(ch);
            clearInterval(interval);
        };
    }, [activeTab, person?.id, userRole?.personId, fetchMessages]);

    // ── tab data loading ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!person) return;
        if (activeTab === 'analytics') fetchAttendance();
        else if (activeTab === 'unit')  fetchUnitStats();
        else if (activeTab === 'chat')  fetchMessages();
    }, [activeTab, person?.id, fetchMessages, fetchAttendance, fetchUnitStats]);

    // ── derived ───────────────────────────────────────────────────────────────
    const presentCount  = attendance.filter(r => r.status === 'PRESENT').length;
    const absentCount   = attendance.length - presentCount;
    const isLeader      = person?.level != null && person.level <= 5;

    const trend = (() => {
        if (attendance.length < 4) return 'neutral';
        const recent = attendance.slice(-3).filter(r => r.status === 'PRESENT').length;
        const prior  = attendance.slice(-6, -3).filter(r => r.status === 'PRESENT').length;
        return recent > prior ? 'up' : recent < prior ? 'down' : 'neutral';
    })();

    const chartData = attendance.slice(-10).map(r => ({
        date: new Date(r.session.session_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: r.status === 'PRESENT' ? 100 : 0,
    }));

    const unitChartData = unitTrend.map(s => ({
        date: new Date(s.session_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: Math.round(s.attendance_rate || 0),
        present: s.total_present,
        total: s.total_marked,
    }));

    const visibleTabs = TABS.filter(t => t.id !== 'unit' || isLeader);

    // ── loading state ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <Loader2 className="animate-spin text-church-blue-500" size={28} />
            </div>
        );
    }

    if (!person) {
        return (
            <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-3 text-slate-400">
                <AlertCircle size={32} />
                <p className="font-semibold">Member not found.</p>
                <button onClick={() => navigate('/directory')} className="text-church-blue-400 text-sm underline">Back to Directory</button>
            </div>
        );
    }

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#020617] text-gray-100 flex flex-col">

            {/* ── top bar ── */}
            <div className="sticky top-0 z-20 bg-[#020617]/90 backdrop-blur-md border-b border-white/[0.05] px-4 py-3 flex items-center gap-3 shrink-0">
                <button
                    onClick={() => navigate('/directory')}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="font-black text-white text-base leading-tight truncate">{person.name}</h1>
                    <p className="text-[9px] font-black uppercase tracking-widest text-church-blue-400 leading-none mt-0.5">{person.role}</p>
                </div>
                {person.photo && (
                    <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/10 shrink-0">
                        <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                    </div>
                )}
            </div>

            {schemaNeedsMigration && (
                <div className="mx-4 mt-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-400 font-semibold flex items-start gap-2.5 animate-fade-in shadow-inner">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                        <p className="font-black text-amber-300 uppercase tracking-wider text-[10px]">Database Migrations Needed</p>
                        <p className="font-semibold text-[10px] text-slate-400 mt-1 leading-relaxed">
                            Please execute the SQL files in your <code className="bg-slate-900 border border-white/5 px-1 py-0.5 rounded text-amber-400 font-bold">supabase/migrations/</code> folder in the Supabase SQL editor to enable phone numbers, DOB, and social media handles.
                        </p>
                    </div>
                </div>
            )}

            {/* ── hero ── */}
            <div className="flex flex-col items-center px-4 pt-8 pb-6 border-b border-white/[0.04]">
                <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center mb-3 shadow-xl">
                    {person.photo
                        ? <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                        : <UserRound size={32} className="text-slate-600" />
                    }
                </div>
                <h2 className="text-xl font-black text-white text-center">{person.name}</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-church-blue-400 mt-0.5">{person.role}</p>
                <p className="text-xs text-slate-500 mt-1">{person.unit}</p>
            </div>

            {/* ── tab bar ── */}
            <div className="flex border-b border-white/[0.06] shrink-0 px-4">
                {visibleTabs.map((tab) => {
                    const TabIcon = tab.Icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex flex-col items-center gap-1 pt-3 pb-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${
                                activeTab === tab.id ? 'text-church-blue-400' : 'text-slate-600 hover:text-slate-400'
                            }`}
                        >
                            <TabIcon size={14} strokeWidth={activeTab === tab.id ? 2.5 : 1.8} />
                            {tab.label}
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="tab-underline"
                                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-church-blue-500 rounded-full"
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── tab content ── */}
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">

                    {/* INFO */}
                    {activeTab === 'info' && (
                        <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }} className="px-4 py-6 space-y-1">

                            {[
                                { Icon: Phone,    label: 'Phone',         value: person.phone },
                                { Icon: Calendar, label: 'Date of Birth', value: person.dob ? new Date(person.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null },
                                { Icon: UserRound, label: 'Age',          value: getAge(person.dob) != null ? `${getAge(person.dob)} years old` : null },
                                { Icon: Globe,    label: 'Social Handle', value: person.socialHandle ? `@${person.socialHandle.replace('@', '')}` : null },
                                { Icon: Shield,   label: 'Position',      value: person.role },
                                { Icon: Mail,     label: 'Unit',          value: person.unit },
                            ].map((item) => {
                                const ItemIcon = item.Icon;
                                return (
                                    <div key={item.label} className="flex items-start gap-3 py-3 border-b border-white/[0.04]">
                                        <ItemIcon size={13} className="text-slate-600 mt-0.5 shrink-0" strokeWidth={1.5} />
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 leading-none">{item.label}</p>
                                            <p className="text-sm text-slate-200 font-medium mt-0.5">{item.value || '—'}</p>
                                        </div>
                                    </div>
                                );
                            })}

                            <button
                                onClick={() => setActiveTab('chat')}
                                className="w-full mt-5 py-3 rounded-2xl border border-church-blue-500/30 text-church-blue-400 text-sm font-bold flex items-center justify-center gap-2 hover:bg-church-blue-500/10 transition-colors"
                            >
                                <MessageCircle size={15} />
                                Send Private Message
                            </button>
                        </motion.div>
                    )}

                    {/* ANALYTICS */}
                    {activeTab === 'analytics' && (
                        <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }} className="px-4 py-6 space-y-8">

                            {analyticsLoading ? (
                                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-church-blue-500" size={22} /></div>
                            ) : attendance.length === 0 ? (
                                <p className="text-center text-slate-600 text-sm py-16">No attendance records yet.</p>
                            ) : (
                                <>
                                    {/* Gauge centered */}
                                    <div className="flex flex-col items-center gap-1">
                                        <AttendanceGauge rate={attendanceRate} />
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Overall Attendance</p>
                                    </div>

                                    {/* Minimal three-number row */}
                                    <div className="grid grid-cols-3 divide-x divide-white/[0.05]">
                                        {[
                                            { num: attendance.length, label: 'Sessions' },
                                            { num: presentCount,      label: 'Present' },
                                            { num: absentCount,       label: 'Absent' },
                                        ].map(({ num, label }) => (
                                            <div key={label} className="flex flex-col items-center py-4">
                                                <span className="text-2xl font-black text-white">{num}</span>
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">{label}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Trend indicator — minimal text only */}
                                    {attendance.length >= 4 && (
                                        <div className="flex items-center gap-1.5 justify-center">
                                            {trend === 'up'      && <TrendingUp  size={13} className="text-emerald-400" />}
                                            {trend === 'down'    && <TrendingDown size={13} className="text-red-400" />}
                                            {trend === 'neutral' && <Minus size={13} className="text-slate-500" />}
                                            <span className={`text-[10px] font-bold ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'}`}>
                                                {trend === 'up' ? 'Improving recently' : trend === 'down' ? 'Declining recently' : 'Steady attendance'}
                                            </span>
                                        </div>
                                    )}

                                    {/* Area chart */}
                                    {chartData.length > 1 && (
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">Presence History</p>
                                            <div className="h-36">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" vertical={false} />
                                                        <XAxis dataKey="date" stroke="#374151" fontSize={8} tickLine={false} axisLine={false} />
                                                        <YAxis domain={[0, 100]} ticks={[0, 100]} stroke="#374151" fontSize={8} tickLine={false} axisLine={false} tickFormatter={v => v === 100 ? 'P' : 'A'} />
                                                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#3b82f615', strokeWidth: 18 }} />
                                                        <Area type="monotone" dataKey="value" name="Attendance" stroke="#3b82f6" strokeWidth={2}
                                                            dot={{ r: 2.5, fill: '#3b82f6', strokeWidth: 0 }}
                                                            activeDot={{ r: 4, fill: '#60a5fa', strokeWidth: 0 }}
                                                            fill="url(#gP)" fillOpacity={1} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}

                                    {/* Recent sessions */}
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">Recent Sessions</p>
                                        <div className="space-y-0">
                                            {attendance.slice(-6).reverse().map((r, i) => (
                                                <div key={i} className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                                                    <span className="text-sm text-slate-400">
                                                        {new Date(r.session.session_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    </span>
                                                    <span className={`text-[10px] font-black uppercase tracking-wider ${r.status === 'PRESENT' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {r.status === 'PRESENT' ? '✓ Present' : '✗ Absent'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* UNIT */}
                    {activeTab === 'unit' && isLeader && (
                        <motion.div key="unit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }} className="px-4 py-6 space-y-8">

                            {unitLoading ? (
                                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-church-blue-500" size={22} /></div>
                            ) : (
                                <>
                                    <div className="flex flex-col items-center gap-1">
                                        <AttendanceGauge rate={unitStats.avgRate} />
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Unit Average</p>
                                    </div>

                                    <div className="grid grid-cols-2 divide-x divide-white/[0.05]">
                                        {[
                                            { num: unitStats.size,       label: 'Members' },
                                            { num: unitTrend.length,     label: 'Sessions' },
                                        ].map(({ num, label }) => (
                                            <div key={label} className="flex flex-col items-center py-4">
                                                <span className="text-2xl font-black text-white">{num}</span>
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">{label}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {unitChartData.length > 0 ? (
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">Weekly Trend</p>
                                            <div className="h-36">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={unitChartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" vertical={false} />
                                                        <XAxis dataKey="date" stroke="#374151" fontSize={8} tickLine={false} axisLine={false} />
                                                        <YAxis domain={[0, 100]} stroke="#374151" fontSize={8} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                                                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#10b98115', strokeWidth: 18 }} />
                                                        <Area type="monotone" dataKey="value" name="Attendance" stroke="#10b981" strokeWidth={2}
                                                            dot={{ r: 2.5, fill: '#10b981', strokeWidth: 0 }}
                                                            activeDot={{ r: 4, fill: '#34d399', strokeWidth: 0 }}
                                                            fill="url(#gU)" fillOpacity={1} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-center text-slate-600 text-sm py-8">No session data for this unit.</p>
                                    )}

                                    {unitChartData.length > 0 && (
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">Session Breakdown</p>
                                            <div className="space-y-0">
                                                {unitTrend.slice().reverse().map((s, i) => (
                                                    <div key={i} className="flex justify-between items-center py-2.5 border-b border-white/[0.04]">
                                                        <div>
                                                            <p className="text-sm text-slate-300">
                                                                {new Date(s.session_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                            </p>
                                                            <p className="text-[9px] text-slate-600 mt-0.5">{s.total_present} present · {s.total_absent} absent</p>
                                                        </div>
                                                        <span className={`text-sm font-black ${Math.round(s.attendance_rate) >= 70 ? 'text-emerald-400' : Math.round(s.attendance_rate) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                                                            {Math.round(s.attendance_rate || 0)}%
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* CHAT */}
                    {activeTab === 'chat' && (
                        <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex flex-col"
                            style={{ height: 'calc(100vh - 200px)' }}
                        >
                            {/* messages feed */}
                            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 min-h-0">
                                {chatLoading ? (
                                    <div className="flex justify-center py-16">
                                        <Loader2 className="animate-spin text-church-blue-500" size={22} />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-16">
                                        <MessageCircle size={28} className="text-slate-700" strokeWidth={1.5} />
                                        <p className="text-slate-500 text-sm">No messages yet</p>
                                        <p className="text-slate-600 text-xs max-w-[200px]">Messages are private and only visible to you and {person.name.split(' ')[0]}.</p>
                                    </div>
                                ) : (
                                    groupByDate(messages).map((item, i) => {
                                        if (item.type === 'date') return (
                                            <div key={i} className="flex items-center gap-2 py-3">
                                                <div className="flex-1 h-px bg-white/[0.05]" />
                                                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{item.label}</span>
                                                <div className="flex-1 h-px bg-white/[0.05]" />
                                            </div>
                                        );
                                        const isMe = item.sender_id === userRole?.personId;
                                        return (
                                            <div key={item.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                                                <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                    <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                                                        isMe
                                                            ? 'bg-church-blue-600 text-white rounded-br-sm'
                                                            : 'bg-slate-800/70 text-slate-100 rounded-bl-sm border border-white/[0.05]'
                                                    }`}>
                                                        {item.message}
                                                    </div>
                                                    <span className="text-[8px] text-slate-700 mt-0.5 px-1">
                                                        {new Date(item.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* input */}
                            <form onSubmit={sendMessage} className="shrink-0 flex gap-2 px-4 py-3 border-t border-white/[0.05]">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    placeholder={`Message ${person.name.split(' ')[0]}...`}
                                    disabled={chatSending}
                                    className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-church-blue-500/40 transition-colors"
                                />
                                <button
                                    type="submit"
                                    disabled={chatSending || !chatInput.trim()}
                                    className="w-10 h-10 rounded-2xl bg-church-blue-600 disabled:opacity-40 text-white flex items-center justify-center hover:bg-church-blue-500 transition-colors active:scale-95 shrink-0"
                                >
                                    {chatSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
