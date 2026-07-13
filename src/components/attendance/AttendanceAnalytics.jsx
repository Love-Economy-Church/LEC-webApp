import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { getFriendlyMessage } from '../../lib/errorUtils';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Users, Calendar, UserX, Activity, UserPlus, Flame, ArrowDownRight, ArrowUpRight, ChevronDown, Search, RotateCcw, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';
import Modal from '../ui/Modal';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';

// ─── Animation Variants ─────────────────────────────────────────────────────
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } }
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }
};

// ─── Custom Chart Tooltip ────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const present = payload.find(p => p.name === 'Present')?.value || 0;
  const absent = payload.find(p => p.name === 'Absent')?.value || 0;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-slate-400 mb-2 font-semibold">{label}</p>
      <p className="text-sm font-bold text-emerald-400">
        Present: <span className="text-white">{present}</span>
      </p>
      <p className="text-sm font-bold text-red-400">
        Absent: <span className="text-white">{absent}</span>
      </p>
      <p className="text-[10px] text-slate-500 mt-1.5 border-t border-slate-700 pt-1.5">
        {present + absent} total · {present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0}% rate
      </p>
    </div>
  );
}

// ─── Sparkline Mini Chart ────────────────────────────────────────────────────
function Sparkline({ data, color = '#ef4444' }) {
  if (!data || data.length < 2) return null;
  const sparkData = data.slice(-8).map(d => ({
    v: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0
  }));
  return (
    <div className="w-24 h-12 opacity-70 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill="url(#sparkGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Hero KPI Card (Attendance Rate) ─────────────────────────────────────────
function HeroKpiCard({ rate, trend, trendValue, history }) {
  const animatedRate = useAnimatedCounter(rate, 1400, true);
  const rateColor = rate >= 80 ? 'text-emerald-400' : rate >= 70 ? 'text-amber-400' : 'text-red-400';
  const iconBorder = rate >= 80 ? 'border-emerald-500/40' : rate >= 70 ? 'border-amber-500/40' : 'border-red-500/40';
  const iconText = rate >= 80 ? 'text-emerald-400' : rate >= 70 ? 'text-amber-400' : 'text-red-400';
  const sparkColor = rate >= 80 ? '#10b981' : rate >= 70 ? '#f59e0b' : '#ef4444';
  const trendColor = trend === 'up' ? 'text-emerald-400' : 'text-red-400';
  const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div variants={fadeUp} className="p-4 rounded-2xl bg-[#0d1525] border border-slate-700/50">
      <div className="flex items-center gap-3">
        {/* Circular icon */}
        <div className={`w-11 h-11 rounded-full border-2 ${iconBorder} flex items-center justify-center shrink-0`}>
          <TrendingUp size={20} className={iconText} />
        </div>
        {/* Rate info */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-0.5">Attendance Rate</p>
          <div className="flex items-baseline gap-3">
            <span className={`text-5xl font-black tabular-nums tracking-tight ${rateColor}`}>{animatedRate}</span>
            {trendValue != null && (
              <div className="flex flex-col">
                <div className={`flex items-center gap-0.5 text-xs font-bold ${trendColor}`}>
                  <TrendIcon size={14} />
                  <span>{trendValue}%</span>
                </div>
                <span className="text-[10px] text-slate-500">vs last</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stats Card (Present / Absent) ───────────────────────────────────────────
function StatsDualCard({ icon: Icon, label, value, sub, iconColor, iconBg, labelColor, onClick }) {
  const animatedValue = useAnimatedCounter(typeof value === 'number' ? value : 0);
  const displayValue = typeof value === 'number' ? animatedValue : value;
  const isClickable = !!onClick;

  return (
    <motion.div
      variants={fadeUp}
      whileHover={isClickable ? { y: -2, scale: 1.01 } : {}}
      onClick={onClick}
      className={`p-3 rounded-2xl bg-[#0d1525] border ${
        isClickable
          ? 'border-slate-700/50 hover:border-slate-500/60 cursor-pointer shadow-lg hover:shadow-slate-950/55 hover:bg-slate-800/20'
          : 'border-slate-700/50'
      } w-full transition-all duration-200`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={16} className={iconColor} />
        </div>
        <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${labelColor}`}>{label}</span>
      </div>
      <div className="text-2xl font-black text-white tracking-tight flex items-baseline gap-1.5 tabular-nums pl-0.5">
        {displayValue}
        {sub && <span className={`text-xs font-bold opacity-60 ${labelColor}`}>{sub}</span>}
      </div>
    </motion.div>
  );
}

// ─── Small Stats Card (Sessions / First Timers / Souls Won) ──────────────────
function StatsSmallCard({ icon: Icon, label, value, sub, iconColor, iconBg, labelColor, onClick }) {
  const animatedValue = useAnimatedCounter(typeof value === 'number' ? value : 0);
  const displayValue = typeof value === 'number' ? animatedValue : value;
  const isClickable = !!onClick;

  return (
    <motion.div
      variants={fadeUp}
      whileHover={isClickable ? { y: -2, scale: 1.01 } : {}}
      onClick={onClick}
      className={`p-3 rounded-2xl bg-[#0d1525] border ${
        isClickable
          ? 'border-slate-700/50 hover:border-slate-500/60 cursor-pointer shadow-lg hover:shadow-slate-950/55 hover:bg-slate-800/20'
          : 'border-slate-700/50'
      } w-full transition-all duration-200`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={14} className={iconColor} />
        </div>
        <span className={`text-[7px] font-black uppercase tracking-[0.12em] ${labelColor}`}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5 pl-0.5">
        <span className="text-lg font-black text-white tracking-tight tabular-nums">{displayValue}</span>
        {sub && <span className={`text-[8px] font-bold opacity-60 ${labelColor}`}>{sub}</span>}
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AttendanceAnalytics({ currentRole, overrideUnitId = null, overrideUnitType = null, overrideUnitName = null }) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [rawSessionData, setRawSessionData] = useState([]);
  const [history, setHistory] = useState([]);
  const [timeFilter, setTimeFilter] = useState('all');

  // Selected session for detail cards inspection
  const [selectedSessionKey, setSelectedSessionKey] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('PRESENT'); // PRESENT, ABSENT, FIRST_TIMER
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Undo session state
  const [activeSession, setActiveSession] = useState(null); // { id, created_at }
  const [undoing, setUndoing] = useState(false);
  const [showUndoModal, setShowUndoModal] = useState(false);

  const fetchAnalytics = async () => {
    const effectiveUnitId = overrideUnitId || currentRole.unitId;
    const effectiveUnitType = overrideUnitType || currentRole.unitType;

    if (!effectiveUnitId) return;
    setLoading(true);

    try {
      let unitIds = [effectiveUnitId];

      if (effectiveUnitType !== 'CELL') {
        const { data: managedData, error: managedError } = await supabase
          .rpc('get_managed_units', { root_parent_id: effectiveUnitId });

        if (!managedError && managedData) {
          unitIds = managedData.map((row) =>
            typeof row === 'object' ? (row.id || row.get_managed_units || Object.values(row)[0]) : row
          );
        } else {
          console.error('Failed to fetch managed units for analytics:', managedError);
          unitIds = [];
        }
      }

      if (unitIds.length === 0) {
        setLoading(false);
        setStats({ total: 0 });
        setRawSessionData([]);
        setHistory([]);
        return;
      }

      const { data: sessionData } = await supabase
        .from('attendance_analytics_view')
        .select('*')
        .in('unit_id', unitIds)
        .order('session_date', { ascending: true });

      if (sessionData) {
        setRawSessionData(sessionData);
        const historyMap = {};
        sessionData.forEach((s) => {
          const date = s.session_date;
          if (!historyMap[date]) historyMap[date] = { date, present: 0, absent: 0, total: 0, firstTimers: 0, soulsWon: 0 };
          historyMap[date].present += s.total_present || 0;
          historyMap[date].absent += s.total_absent || 0;
          historyMap[date].total += s.total_marked || 0;
          historyMap[date].firstTimers += s.first_timers_count || 0;
          historyMap[date].soulsWon += s.souls_won_count || 0;
        });

        const sortedHistory = Object.values(historyMap).sort((a, b) => new Date(a.date) - new Date(b.date));

        let trend = null;
        let trendValue = null;
        let latestRate = 0;
        let latestTotal = 0;
        let latestPresent = 0;
        let latestAbsent = 0;
        let latestFirstTimers = 0;
        let latestSoulsWon = 0;

        if (sortedHistory.length > 0) {
          const last = sortedHistory[sortedHistory.length - 1];
          latestTotal = last.total;
          latestPresent = last.present;
          latestAbsent = last.absent;
          latestFirstTimers = last.firstTimers;
          latestSoulsWon = last.soulsWon;
          latestRate = latestTotal > 0 ? Math.round((latestPresent / latestTotal) * 100) : 0;

          if (sortedHistory.length >= 2) {
            const prev = sortedHistory[sortedHistory.length - 2];
            const prevRate = prev.total > 0 ? Math.round((prev.present / prev.total) * 100) : 0;
            const diff = latestRate - prevRate;
            trend = diff >= 0 ? 'up' : 'down';
            trendValue = diff;
          }
        } else {
          setStats(null);
          setHistory([]);
          return;
        }

        setStats({
          rate: latestRate, total: latestTotal, present: latestPresent,
          absent: latestAbsent, firstTimers: latestFirstTimers,
          soulsWon: latestSoulsWon, trend, trendValue
        });
        setHistory(sortedHistory);
      } else {
        setRawSessionData([]);
        setStats(null);
        setHistory([]);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [currentRole.unitId, currentRole.unitType, overrideUnitId, overrideUnitType]);

  // Fetch the active session for the current selection and scope
  useEffect(() => {
    async function fetchActiveSession() {
      if (!selectedSessionKey) {
        setActiveSession(null);
        return;
      }
      const [datePart, ...serviceParts] = selectedSessionKey.split('_');
      const serviceNamePart = serviceParts.join('_');
      const effectiveUnitId = overrideUnitId || currentRole.unitId;

      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('id, created_at')
        .eq('unit_id', effectiveUnitId)
        .eq('session_date', datePart)
        .eq('service_name', serviceNamePart)
        .maybeSingle();

      if (!error && data) {
        setActiveSession(data);
      } else {
        setActiveSession(null);
      }
    }
    fetchActiveSession();
  }, [selectedSessionKey, overrideUnitId, currentRole.unitId]);

  const ADMIN_ROLES = ['Alpha Branch Pastor', 'Church Head', 'MC Head', 'Buscenta Head', 'Assembly Head', 'MC Live Head'];
  const isAdmin = ADMIN_ROLES.includes(currentRole?.title);
  const isDirectUnit = (overrideUnitId || currentRole.unitId) === currentRole.unitId;
  const canMark = isDirectUnit || currentRole.unitType === 'MC';

  const sessionAgeHours = activeSession?.created_at
    ? (Date.now() - new Date(activeSession.created_at).getTime()) / (1000 * 60 * 60)
    : Infinity;

  const canUndoSession = !!activeSession && (isAdmin || (canMark && sessionAgeHours <= 24));
  const undoBlockedReason = !!activeSession && !canUndoSession
    ? 'The 24-hour undo window has passed. Contact an admin to undo this session.'
    : null;

  const handleUndoSession = async () => {
    if (!canUndoSession || !activeSession) return;
    setUndoing(true);
    try {
      const { error } = await supabase
        .from('attendance_sessions')
        .delete()
        .eq('id', activeSession.id);

      if (error) throw error;

      cacheService.remove(CACHE_KEYS.PEOPLE);
      cacheService.remove(CACHE_KEYS.HIERARCHY);

      setShowUndoModal(false);
      setActiveSession(null);
      setSelectedSessionKey('');
      
      // Reload analytics to update charts/dropdown
      await fetchAnalytics();
    } catch (err) {
      console.error('Error undoing session:', err);
      alert(getFriendlyMessage(err, 'The session could not be undone. Please try again.'));
    } finally {
      setUndoing(false);
    }
  };

  // ── Derive historical sessions dropdown list ──
  const sessionsList = useMemo(() => {
    if (!rawSessionData || rawSessionData.length === 0) return [];
    const list = [];
    const seen = new Set();
    rawSessionData.forEach((s) => {
      const key = `${s.session_date}_${s.service_name || 'Mega Gathering Service'}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          date: s.session_date,
          serviceName: s.service_name || 'Mega Gathering Service',
          key: key
        });
      }
    });
    // Sort reverse chronological (newest sessions first)
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [rawSessionData]);

  // ── Sync default selected session to newest when list loads ──
  useEffect(() => {
    if (sessionsList.length > 0) {
      if (!selectedSessionKey || !sessionsList.some(s => s.key === selectedSessionKey)) {
        setSelectedSessionKey(sessionsList[0].key);
      }
    } else {
      setSelectedSessionKey('');
    }
  }, [sessionsList, selectedSessionKey]);

  // ── Compute stats for the selected session ──
  const cardStats = useMemo(() => {
    if (!selectedSessionKey || !rawSessionData || rawSessionData.length === 0) return null;

    let present = 0;
    let absent = 0;
    let total = 0;
    let firstTimers = 0;
    let soulsWon = 0;

    rawSessionData.forEach(s => {
      const key = `${s.session_date}_${s.service_name || 'Mega Gathering Service'}`;
      if (key === selectedSessionKey) {
        present += s.total_present || 0;
        absent += s.total_absent || 0;
        total += s.total_marked || 0;
        firstTimers += s.first_timers_count || 0;
        soulsWon += s.souls_won_count || 0;
      }
    });

    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      rate,
      total,
      present,
      absent,
      firstTimers,
      soulsWon
    };
  }, [selectedSessionKey, rawSessionData]);

  const selectedSessionInfo = useMemo(() => {
    return sessionsList.find(s => s.key === selectedSessionKey);
  }, [sessionsList, selectedSessionKey]);

  // ── Fetch detailed present/absent list ──
  const fetchDetailList = async (type, sessionKey) => {
    if (!sessionKey) return;
    setModalType(type);
    setModalOpen(true);
    setModalLoading(true);

    try {
      const [datePart, ...serviceParts] = sessionKey.split('_');
      const serviceNamePart = serviceParts.join('_');

      const effectiveUnitId = overrideUnitId || currentRole.unitId;
      const effectiveUnitType = overrideUnitType || currentRole.unitType;

      let unitIds = [effectiveUnitId];
      if (effectiveUnitType !== 'CELL') {
        const { data: managedData, error: managedError } = await supabase
          .rpc('get_managed_units', { root_parent_id: effectiveUnitId });
        if (!managedError && managedData) {
          unitIds = managedData.map((row) =>
            typeof row === 'object' ? (row.id || row.get_managed_units || Object.values(row)[0]) : row
          );
        }
      }

      if (unitIds.length === 0) {
        setModalData([]);
        setModalLoading(false);
        return;
      }

      // 1. Get session IDs matching this date and service name
      const { data: sessions, error: sessionsError } = await supabase
        .from('attendance_sessions')
        .select('id, service_name, unit_id')
        .in('unit_id', unitIds)
        .eq('session_date', datePart)
        .eq('service_name', serviceNamePart);

      if (sessionsError) throw sessionsError;

      if (!sessions || sessions.length === 0) {
        setModalData([]);
        setModalLoading(false);
        return;
      }

      const sessionIds = sessions.map(s => s.id);

      // 2. Fetch all individual attendance records under these sessions
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select(`
          id,
          status,
          notes,
          person:people(
            id,
            full_name,
            photo_url,
            is_placeholder,
            created_at,
            assignments:position_assignments(
              is_active,
              position:positions(title),
              unit:organizational_units(name, unit_type)
            ),
            attendance_records(status)
          ),
          session:attendance_sessions(
            id,
            service_name,
            unit:organizational_units(id, name, unit_type)
          )
        `)
        .in('session_id', sessionIds);

      if (recordsError) throw recordsError;

      // 3. Format and enrich records with role and membership state
      const formatted = records.map(r => {
        const p = r.person;
        if (!p) return null;

        const activeAssignment = p.assignments?.find(a => a.is_active);
        const role = activeAssignment?.position?.title || 'Member';
        const unitName = r.session?.unit?.name || activeAssignment?.unit?.name || 'Unassigned';

        // Calculate membership state based on cumulative present sessions
        let presentCount = 0;
        if (p.attendance_records && p.attendance_records.length > 0) {
          presentCount = p.attendance_records.filter(rec => rec.status === 'PRESENT').length;
        }

        let membership_state = role;
        // Pipeline ONLY applies to people registered as 'First Timer' (added from the attendance screen).
        // Anyone added via the directory with 'Cell Member', 'Member', or 'Unassigned' is already a
        // member and must always appear as 'Member', regardless of attendance count.
        if (role === 'First Timer') {
          if (presentCount <= 1) membership_state = 'First Timer';
          else if (presentCount === 2 || presentCount === 3) membership_state = 'Brethren';
          else if (presentCount >= 4) membership_state = 'Member';
        } else if (role === 'Cell Member' || role === 'Member' || role === 'Unassigned') {
          membership_state = 'Member';
        }

        return {
          id: p.id,
          name: p.full_name,
          photo: p.photo_url,
          role,
          unitName,
          status: r.status,
          membership_state,
          is_placeholder: p.is_placeholder
        };
      }).filter(Boolean);

      // Filter based on the clicked card type
      let filtered = [];
      if (type === 'PRESENT') {
        filtered = formatted.filter(r => r.status === 'PRESENT');
      } else if (type === 'ABSENT') {
        filtered = formatted.filter(r => r.status === 'ABSENT');
      } else if (type === 'FIRST_TIMER') {
        filtered = formatted.filter(r =>
          r.status === 'PRESENT' &&
          (r.role === 'First Timer' || ['First Timer', 'Brethren'].includes(r.membership_state))
        );
      }

      // Sort alphabetically by full name
      filtered.sort((a, b) => a.name.localeCompare(b.name));

      setModalData(filtered);
    } catch (e) {
      console.error("Error fetching roster details:", e);
    } finally {
      setModalLoading(false);
    }
  };

  // ── Filtered History ──
  const filteredHistory = useMemo(() => {
    if (timeFilter === 'all') return history;
    const days = parseInt(timeFilter);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return history.filter(h => new Date(h.date) >= cutoff);
  }, [history, timeFilter]);

  // ── Auto Insight ──
  const insight = useMemo(() => {
    if (filteredHistory.length < 2) return null;
    const recentHalf = filteredHistory.slice(Math.floor(filteredHistory.length / 2));
    const olderHalf = filteredHistory.slice(0, Math.floor(filteredHistory.length / 2));
    const recentAvg = recentHalf.reduce((a, h) => a + (h.total > 0 ? (h.present / h.total) * 100 : 0), 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((a, h) => a + (h.total > 0 ? (h.present / h.total) * 100 : 0), 0) / olderHalf.length;
    const diff = Math.round(recentAvg - olderAvg);
    if (Math.abs(diff) < 2) return { text: 'Attendance has been stable across this period.', type: 'neutral' };
    if (diff > 0) return { text: `Attendance improved by ~${diff}% in recent sessions.`, type: 'up' };
    return { text: `Attendance dropped by ~${Math.abs(diff)}% in recent sessions.`, type: 'down' };
  }, [filteredHistory]);

  // ── Search & Filter states inside Modal ──
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('');

  // Reset modal filters on open
  useEffect(() => {
    if (modalOpen) {
      setSearchTerm('');
      setSelectedUnitFilter('');
    }
  }, [modalOpen]);

  const uniqueUnits = useMemo(() => {
    const units = new Set();
    modalData.forEach(m => {
      if (m.unitName) units.add(m.unitName);
    });
    return Array.from(units).sort();
  }, [modalData]);

  const filteredModalList = useMemo(() => {
    return modalData.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUnit = !selectedUnitFilter || m.unitName === selectedUnitFilter;
      return matchesSearch && matchesUnit;
    });
  }, [modalData, searchTerm, selectedUnitFilter]);

  const getInitialsColor = (name) => {
    const colors = [
      'from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30',
      'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30',
      'from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30',
      'from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30',
      'from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-church-blue-500" size={40} />
      </div>
    );
  }

  // ── Empty State ──
  if (!stats || stats.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-slate-400">
        <div className="w-20 h-20 rounded-2xl bg-church-blue-500/10 flex items-center justify-center mb-5">
          <TrendingUp size={40} className="text-church-blue-400 opacity-60" />
        </div>
        <p className="text-lg font-bold text-slate-200">No attendance data yet</p>
        <p className="text-sm mt-1.5 text-slate-500 max-w-xs text-center">Start by marking attendance for your unit. Analytics will appear here automatically.</p>
      </div>
    );
  }

  const activeStats = cardStats || stats;

  // ── Main View ──
  return (
    <div className="space-y-4">

      {/* ── Row 0: Redesigned Session Selector ── */}
      {sessionsList.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full mb-2">
          {/* Custom Styled Select Dropdown (matches image exactly) */}
          <div className="relative flex-1">
            <select
              value={selectedSessionKey}
              onChange={(e) => setSelectedSessionKey(e.target.value)}
              className="w-full appearance-none bg-[#090e1a] hover:bg-[#0c1425] border border-slate-800/80 text-sm text-slate-200 rounded-2xl pl-12 pr-10 py-3.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all font-semibold"
            >
              {sessionsList.map(s => {
                const formattedDate = new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                return (
                  <option key={s.key} value={s.key} className="bg-slate-900 text-slate-300">
                    {formattedDate} • {s.serviceName}
                  </option>
                );
              })}
            </select>
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none" size={18} />
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
          </div>

          {/* Undo Session Button */}
          {activeSession && (
            <button
              type="button"
              onClick={() => canUndoSession ? setShowUndoModal(true) : alert(undoBlockedReason)}
              disabled={undoing || loading}
              title={undoBlockedReason || 'Undo this attendance session'}
              className={`flex items-center justify-center gap-1.5 border px-4 py-3.5 rounded-2xl font-bold text-xs transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${
                canUndoSession
                  ? 'border-rose-500/40 hover:border-rose-500/70 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300'
                  : 'border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              {undoing ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
              <span>{undoing ? 'Undoing...' : 'Undo Session'}</span>
            </button>
          )}
        </div>
      )}

      {/* ── Row 1: Hero Attendance Rate ── */}
      <motion.div variants={stagger} initial="hidden" animate="show">
        <HeroKpiCard
          rate={activeStats.rate}
          trend={stats.trend}
          trendValue={stats.trendValue}
          history={history}
        />
      </motion.div>

      {/* ── Row 3: Present / Absent ── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3">
        <StatsDualCard
          icon={Users}
          label="Total Present"
          value={activeStats.present}
          sub={`/ ${activeStats.total}`}
          iconColor="text-emerald-300"
          iconBg="bg-emerald-500/20 border border-emerald-500/30"
          labelColor="text-emerald-400"
          onClick={selectedSessionKey ? () => fetchDetailList('PRESENT', selectedSessionKey) : null}
        />
        <StatsDualCard
          icon={UserX}
          label="Total Absent"
          value={activeStats.absent}
          sub={`/ ${activeStats.total}`}
          iconColor="text-red-300"
          iconBg="bg-red-500/20 border border-red-500/30"
          labelColor="text-red-400"
          onClick={selectedSessionKey ? () => fetchDetailList('ABSENT', selectedSessionKey) : null}
        />
      </motion.div>

      {/* ── Row 4: Sessions / First Timers / Souls Won ── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-3 gap-3">
        <StatsSmallCard
          icon={Calendar}
          label="Sessions"
          value={history.length}
          sub="Recorded"
          iconColor="text-blue-300"
          iconBg="bg-blue-500/15 border border-blue-500/25"
          labelColor="text-blue-400"
        />
        <StatsSmallCard
          icon={UserPlus}
          label="First Timers"
          value={activeStats.firstTimers ?? 0}
          sub="Latest"
          iconColor="text-purple-300"
          iconBg="bg-purple-500/15 border border-purple-500/25"
          labelColor="text-purple-400"
          onClick={selectedSessionKey ? () => fetchDetailList('FIRST_TIMER', selectedSessionKey) : null}
        />
        <StatsSmallCard
          icon={Flame}
          label="Souls Won"
          value={activeStats.soulsWon ?? 0}
          sub="Latest"
          iconColor="text-amber-300"
          iconBg="bg-amber-500/15 border border-amber-500/25"
          labelColor="text-amber-400"
        />
      </motion.div>

      {/* ── Row 5: Attendance Trend Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-[#0d1525] p-5 rounded-2xl border border-slate-700/50"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Activity size={20} className="text-church-blue-400" />
            Attendance Trend
          </h3>
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none bg-slate-800/80 border border-slate-600/50 text-slate-300 text-xs font-bold rounded-xl pl-3 pr-8 py-2 cursor-pointer focus:outline-none focus:ring-1 focus:ring-church-blue-500/50 transition-colors"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Auto Insight */}
        {insight && (
          <div className={`flex items-center gap-2.5 text-[11px] font-semibold px-4 py-2.5 rounded-xl mb-5 ${
            insight.type === 'up'   ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            insight.type === 'down' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                      'bg-slate-800 text-slate-400 border border-slate-700/50'
          }`}>
            {insight.type === 'up' && <TrendingUp size={16} className="shrink-0" />}
            {insight.type === 'down' && <TrendingDown size={16} className="shrink-0" />}
            {insight.text}
          </div>
        )}

        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAbsent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#334155"
                fontSize={11}
                tickFormatter={(val) => val.substring(5)}
                tick={{ fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="#334155"
                fontSize={11}
                tick={{ fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="present"
                name="Present"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#gradPresent)"
                dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#10b981' }}
              />
              <Area
                type="monotone"
                dataKey="absent"
                name="Absent"
                stroke="#ef4444"
                strokeWidth={2.5}
                fill="url(#gradAbsent)"
                dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#ef4444' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Attendance Roster Modal ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          modalType === 'PRESENT' ? 'People Present' :
          modalType === 'ABSENT' ? 'People Absent' :
          'First Timers / Brethren'
        }
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {/* Subtitle / Session Date Info */}
          {selectedSessionInfo && (
            <div className="bg-[#0b101b] border border-slate-800/80 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 flex items-center justify-between">
              <span>Date: {new Date(selectedSessionInfo.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span className="text-church-blue-400">{selectedSessionInfo.serviceName}</span>
            </div>
          )}



          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#070b13] border border-slate-700/50 hover:border-slate-600/80 focus:border-church-blue-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Cell Unit Filter */}
            {uniqueUnits.length > 1 && (
              <div className="relative shrink-0 sm:w-48">
                <select
                  value={selectedUnitFilter}
                  onChange={(e) => setSelectedUnitFilter(e.target.value)}
                  className="w-full appearance-none bg-[#070b13] border border-slate-700/50 hover:border-slate-600/80 focus:border-church-blue-500/50 text-slate-300 text-xs font-black rounded-xl pl-3.5 pr-9 py-3 cursor-pointer focus:outline-none transition-colors"
                >
                  <option value="">All Cells</option>
                  {uniqueUnits.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Modal List Content */}
          <div className="min-h-[250px] max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
            {modalLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="animate-spin text-church-blue-500 mb-3" size={32} />
                <span className="text-xs font-bold uppercase tracking-wider">Loading Roster...</span>
              </div>
            ) : filteredModalList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 italic text-sm text-center">
                No people match the selected criteria.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredModalList.map((person) => {
                  const initialsColor = getInitialsColor(person.name);
                  const isFirstTimer = person.role === 'First Timer' || ['First Timer', 'Brethren'].includes(person.membership_state);

                  return (
                    <div
                      key={person.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-slate-800 bg-[#070b13]/40 hover:bg-[#070b13]/80 hover:border-slate-700/40 transition-all duration-150"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                          {person.photo ? (
                            <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${initialsColor} flex items-center justify-center font-black text-xs border`}>
                              {getInitials(person.name)}
                            </div>
                          )}
                        </div>

                        {/* Name and unit */}
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-200 text-sm truncate leading-snug">{person.name}</span>
                          <span className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{person.unitName}</span>
                        </div>
                      </div>

                      {/* Role & Status Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {person.is_placeholder && (
                          <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-md font-black uppercase tracking-wider">
                            Virtual
                          </span>
                        )}

                        {person.role && person.role !== 'Unassigned' && (
                          <span className="text-[8px] bg-church-blue-500/15 text-church-blue-400 border border-church-blue-500/35 px-2 py-0.5 rounded-md font-black uppercase tracking-wider">
                            {person.role}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Undo Session Confirmation Modal */}
      {showUndoModal && selectedSessionInfo && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={() => !undoing && setShowUndoModal(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
          <div
            className="relative w-full max-w-xs sm:max-w-sm bg-[#0d1117] border border-rose-500/20 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Trash2 size={24} className="text-rose-400" />
            </div>

            {/* Text */}
            <div className="text-center space-y-1">
              <p className="text-base font-black text-slate-100">Undo Attendance Session?</p>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                This will permanently delete the <span className="text-white font-black">{selectedSessionInfo.serviceName}</span> session for <span className="text-white font-black">{overrideUnitName || currentRole.unitName}</span> on <span className="text-white font-black">{new Date(selectedSessionInfo.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>.
              </p>
              <p className="text-[10px] text-rose-400 font-bold mt-2">
                ⚠ All attendance records for this session will be erased. This cannot be undone.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setShowUndoModal(false)}
                disabled={undoing}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-black text-xs hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleUndoSession}
                disabled={undoing}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {undoing ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
                {undoing ? 'Deleting...' : 'Yes, Undo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
