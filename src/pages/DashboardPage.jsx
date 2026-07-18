import { IonPage, IonContent } from '@ionic/react';
import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchPeople } from '../services/peopleService'
import { Users, LayoutGrid, CheckCircle2, UserPlus, Download, Share } from 'lucide-react'
import { motion } from 'framer-motion'
import HierarchyTree from '../components/HierarchyTree'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAnimatedCounter } from '../hooks/useAnimatedCounter'
import FirstTimersWeeklyModal from '../components/attendance/FirstTimersWeeklyModal'
import BirthdaySection from '../components/birthdays/BirthdaySection'
import AnnouncementsSection from '../components/announcements/AnnouncementsSection'

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } }
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
}

// ── PWA Install Hook ──
function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    setIsIOS(ios);
    if (ios && !window.matchMedia('(display-mode: standalone)').matches) {
      setCanInstall(true);
    }
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setCanInstall(false);
    }
  };

  return { canInstall, isIOS, isStandalone, install };
}

export default function DashboardPage() {
  const { user, userRole, getManagedUnits } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ 
    members: 0, 
    membersBreakdown: [],
    activeCells: 0,
    assigned: 0,
    totalUnits: 0,
    unitBreakdown: [],
    attendanceRate: 0,
    attendanceTrend: 0,
    firstTimers: 0
  })
  const [loading, setLoading] = useState(true)
  const [focusMembersTrigger, setFocusMembersTrigger] = useState(0)
  const [highlightTree, setHighlightTree] = useState(false)
  const [isFirstTimersModalOpen, setIsFirstTimersModalOpen] = useState(false)
  const [weeklyAttendanceData, setWeeklyAttendanceData] = useState([])
  const treeContainerRef = useRef(null)
  const location = useLocation()

  const handleFocusMembers = () => {
    setFocusMembersTrigger(Date.now())
    setHighlightTree(true)
    setTimeout(() => setHighlightTree(false), 2000)
    
    if (treeContainerRef.current) {
        const yOffset = -80; // Account for any fixed headers
        const element = treeContainerRef.current;
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  useEffect(() => {
    async function fetchStats() {
      try {
        const managedUnits = user ? await getManagedUnits() : 'ALL'
        
        if (managedUnits !== 'ALL' && managedUnits.size === 0) {
            setStats({ 
              members: 0, 
              membersBreakdown: [],
              activeCells: 0, 
              assigned: 0, 
              totalUnits: 0, 
              unitBreakdown: [],
              attendanceRate: 0,
              attendanceTrend: 0,
              firstTimers: 0
            })
            setLoading(false)
            return
        }

        const unitIdsArray = managedUnits === 'ALL' ? null : Array.from(managedUnits)

        const allPeople = await fetchPeople()
        
        // Hide staging members/first timers who are not yet Brethren or Members to match the directory
        const filteredPeople = allPeople.filter(p => {
            if (p.membership_state === 'First Timer') {
                return false;
            }
            return true;
        });

        let activeCount = 0;
        let inactiveCount = 0;
        let pendingCount = 0;
        
        let memBranch = 0;
        let memChurch = 0;
        let memMC = 0;
        let memBusc = 0;
        let memCell = 0;
        
        const processPerson = (p) => {
            if (p.status === 'Active' || p.status === 'System') activeCount++;
            else if (p.status === 'Inactive') inactiveCount++;
            else if (p.status === 'Pending') pendingCount++;
            
            if (p.unit_type === 'BRANCH') memBranch++;
            else if (p.unit_type === 'CHURCH') memChurch++;
            else if (p.unit_type === 'MC') memMC++;
            else if (p.unit_type === 'BUSCENTA') memBusc++;
            else if (p.unit_type === 'CELL') memCell++;
        };
        
        if (unitIdsArray) {
            const unitIdsSet = new Set(unitIdsArray);
            filteredPeople.forEach(p => {
                if(unitIdsSet.has(p.unit_id)) processPerson(p);
            });
        } else {
            filteredPeople.forEach(processPerson);
        }
        const memberCount = activeCount + inactiveCount + pendingCount;
        const membersBreakdown = [
            { label: 'Active', value: activeCount, colorClass: 'text-emerald-400' },
            { label: 'Pending', value: pendingCount, colorClass: 'text-amber-400' },
            { label: 'Inactive', value: inactiveCount, colorClass: 'text-slate-400' }
        ];

        let unitsQuery = supabase
          .from('organizational_units')
          .select('id, name, unit_type')

        if (unitIdsArray) unitsQuery = unitsQuery.in('id', unitIdsArray)
        const { data: units } = await unitsQuery

        let assignsQuery = supabase
          .from('position_assignments')
          .select('unit_id, person_id')
          .eq('is_active', true)

        if (unitIdsArray) assignsQuery = assignsQuery.in('unit_id', unitIdsArray)
        const { data: assignments } = await assignsQuery

        const totalUnits = units?.length || 0
        const cells = units?.filter(u => u.unit_type === 'CELL') || []
        
        const branchesCount = units?.filter(u => u.unit_type === 'BRANCH').length || 0
        const churchesCount = units?.filter(u => u.unit_type === 'CHURCH').length || 0
        const mcsCount = units?.filter(u => u.unit_type === 'MC').length || 0
        const buscentasCount = units?.filter(u => u.unit_type === 'BUSCENTA').length || 0
        const cellsCount = cells.length
        
        const unitBreakdown = [
            { label: 'Branches', value: branchesCount, colorClass: 'text-church-yellow-400' },
            { label: 'Churches', value: churchesCount, colorClass: 'text-church-purple-400' },
            { label: 'MCs', value: mcsCount, colorClass: 'text-church-blue-400' },
            { label: 'Buscentas', value: buscentasCount, colorClass: 'text-church-magenta-400' },
            { label: 'Cells', value: cellsCount, colorClass: 'text-church-coral-400' }
        ];

        const assignedUnitIds = new Set(assignments?.map(a => a.unit_id) || [])
        const cellsWithLeaders = cells.filter(c => assignedUnitIds.has(c.id)).length
        const uniquePersonIds = new Set(assignments?.map(a => a.person_id) || [])
        const uniqueAssigned = uniquePersonIds.size

        let attendanceQuery = supabase.from('attendance_analytics_view').select('session_date, service_name, total_present, total_marked, first_timers_count')
        if (unitIdsArray) attendanceQuery = attendanceQuery.in('unit_id', unitIdsArray)
        const { data: attendanceData } = await attendanceQuery
        setWeeklyAttendanceData(attendanceData || [])

        let attendanceRate = 0;
        let attendanceTrend = 0;
        let firstTimers = 0;
        let currentSessionLabel = 'Current marked sessions';

        if (attendanceData && attendanceData.length > 0) {
            const dateMap = {};
            attendanceData.forEach(row => {
                if (!dateMap[row.session_date]) {
                    dateMap[row.session_date] = { date: row.session_date, present: 0, marked: 0, firstTimers: 0 };
                }
                dateMap[row.session_date].present += row.total_present || 0;
                dateMap[row.session_date].marked += row.total_marked || 0;
                dateMap[row.session_date].firstTimers += row.first_timers_count || 0;
            });
            const sortedDates = Object.values(dateMap).sort((a, b) => new Date(b.date) - new Date(a.date));
            
            if (sortedDates.length > 0) {
                const latest = sortedDates[0];
                attendanceRate = latest.marked > 0 ? Math.round((latest.present / latest.marked) * 100) : 0;
                firstTimers = latest.firstTimers;
                currentSessionLabel = 'Current marked sessions';

                if (sortedDates.length > 1) {
                    const prev = sortedDates[1];
                    const prevRate = prev.marked > 0 ? Math.round((prev.present / prev.marked) * 100) : 0;
                    attendanceTrend = attendanceRate - prevRate;
                }
            }
        }


        setStats({ 
          members: memberCount || 0, 
          membersBreakdown,
          activeCells: cellsWithLeaders,
          assigned: uniqueAssigned,
          totalUnits,
          unitBreakdown,
          attendanceRate,
          attendanceTrend,
          firstTimers,
          currentSessionLabel
        })
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [location.pathname, getManagedUnits])

  const { canInstall, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  }, [])

  const dashboardTitle = userRole?.unitName || 'Alpha Branch'
  const titleSuffix = userRole?.unitName ? 'Dashboard' : 'Homepage'

  return (
    // <IonPage>
    //   <IonContent className="ion-padding-bottom">
    <>
        <div className="space-y-10 animate-in fade-in duration-500">

          {/* ── Command Center Header ── */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] mb-1">
            {greeting}
          </p>
          <h1 className="text-2xl md:text-4xl font-black text-white leading-tight">
            {dashboardTitle} <span className="text-slate-500 font-bold">{titleSuffix}</span>
          </h1>
          <div className="flex items-center gap-2 mt-2 text-slate-500">
            <span className="text-[11px] font-semibold">
              {userRole?.unitName ? 'Here is what is happening in your Church' : 'Welcome to the Alpha Branch portal'}
            </span>
          </div>
        </div>

        {/* ── Install App Button ── */}
        {canInstall && (
          <div className="relative">
            {isIOS ? (
              <div className="relative">
                <button
                  id="install-app-btn"
                  onClick={() => setShowIOSGuide(g => !g)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-church-blue-600 to-church-blue-500 text-white text-sm font-bold shadow-lg shadow-church-blue-500/30 hover:shadow-church-blue-500/50 hover:scale-105 transition-all duration-200 border border-church-blue-400/40"
                >
                  <Download size={16} />
                  Install App
                </button>
                {showIOSGuide && (
                  <div className="absolute right-0 top-12 w-72 bg-slate-900/95 backdrop-blur-xl border border-church-blue-500/40 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="text-white font-bold text-sm mb-2">Install on iPhone / iPad</p>
                    <ol className="text-slate-400 text-xs space-y-2">
                      <li className="flex items-start gap-2"><span className="text-church-blue-400 font-bold shrink-0">1.</span> Tap the <span className="text-church-blue-400 font-bold mx-1">Share</span> button at the bottom of Safari</li>
                      <li className="flex items-start gap-2"><span className="text-church-blue-400 font-bold shrink-0">2.</span> Scroll down and tap <span className="text-church-blue-400 font-bold mx-1">Add to Home Screen</span></li>
                      <li className="flex items-start gap-2"><span className="text-church-blue-400 font-bold shrink-0">3.</span> Tap <span className="text-church-blue-400 font-bold mx-1">Add</span> to confirm</li>
                    </ol>
                    <button onClick={() => setShowIOSGuide(false)} className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors">Dismiss</button>
                  </div>
                )}
              </div>
            ) : (
              <button
                id="install-app-btn"
                onClick={install}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-church-blue-600 to-church-blue-500 text-white text-sm font-bold shadow-lg shadow-church-blue-500/30 hover:shadow-church-blue-500/50 hover:scale-105 transition-all duration-200 border border-church-blue-400/40"
              >
                <Download size={16} />
                Install App
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Stats Cards ── */}
      <motion.div 
        variants={stagger} 
        initial="hidden" 
        animate="show" 
        className="grid grid-cols-2 gap-3 md:gap-4"
      >
        <motion.div variants={fadeUp}>
          <StatCard 
            label="Total Members" 
            value={stats.members} 
            icon={<Users size={18} />} 
            color="blue" 
            details={stats.membersBreakdown}
            onClick={handleFocusMembers}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard 
            label="Total Units" 
            value={stats.totalUnits} 
            icon={<LayoutGrid size={18} />} 
            color="amber" 
            details={stats.unitBreakdown}
            onClick={() => navigate('/mindmap')}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard 
            label="Attendance Rate" 
            value={stats.attendanceRate} 
            icon={<CheckCircle2 size={18} />} 
            color="emerald" 
            subText={stats.currentSessionLabel || 'Current marked sessions'}
            trend={stats.attendanceTrend}
            onClick={() => navigate('/attendance?tab=analytics')}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <div className="relative">
            <StatCard 
              label="First Timers" 
              value={stats.firstTimers} 
              icon={<UserPlus size={18} />} 
              color="violet" 
              subText="From most recent session"
              onClick={() => setIsFirstTimersModalOpen(!isFirstTimersModalOpen)}
            />
            <FirstTimersWeeklyModal 
                isOpen={isFirstTimersModalOpen} 
                onClose={() => setIsFirstTimersModalOpen(false)} 
                attendanceData={weeklyAttendanceData} 
            />
          </div>
        </motion.div>
      </motion.div>

      {/* ── Birthday Celebrations ── */}
      <BirthdaySection />

      {/* ── Announcements ── */}
      <AnnouncementsSection userRole={userRole} />

      {/* Hierarchy Tree Card */}
      <motion.div 
        ref={treeContainerRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={`border rounded-2xl p-4 md:p-6 shadow-xl overflow-visible transition-colors duration-1000 ${highlightTree ? 'border-church-blue-500/50 bg-church-blue-500/10 ring-2 ring-church-blue-500/50' : 'border-slate-700/50 bg-slate-900/50'}`}
      >
        <HierarchyTree focusTrigger={focusMembersTrigger} />
      </motion.div>
        </div>
    </>
      // </IonContent>
    // </IonPage>
  )
}

function StatCard({ label, value, icon, color, subText, details, onClick, trend }) {
  const animatedValue = useAnimatedCounter(value)

  const iconBg = {
    blue: 'bg-church-blue-500/10 text-church-blue-400 border-church-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    violet: 'bg-church-purple-500/10 text-church-purple-400 border-church-purple-500/20',
  }

  return (
    <div 
      onClick={onClick}
      className={`px-3.5 py-3 md:px-5 md:py-4 rounded-2xl bg-slate-800/50 border border-slate-700/40 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 group h-full ${onClick ? 'cursor-pointer hover:bg-slate-800/70' : 'cursor-default'}`}
    >
      {/* Top Row: Icon and Value + Trend */}
      <div className="flex items-center justify-between gap-2 mb-2 w-full">
        <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl ${iconBg[color]} border flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110`}>
           {icon}
        </div>
        <div className="flex items-center gap-1.5 leading-none shrink-0">
          <span className="text-lg md:text-2xl font-black text-white tabular-nums">
            {animatedValue}{trend !== undefined ? '%' : ''}
          </span>
          {trend !== undefined && (
            <span className={`text-[9px] md:text-[10px] font-bold ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>
      </div>
      
      {/* Middle Row: Title Label + Optional Arrow */}
      <div className="flex items-center justify-between gap-1 w-full mt-auto">
        <span className="text-[10px] md:text-xs font-bold text-slate-300 truncate tracking-wide uppercase opacity-90">{label}</span>
        {onClick && (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 shrink-0 group-hover:text-slate-300 transition-colors ml-auto"><path d="m9 18 6-6-6-6"/></svg>
        )}
      </div>
      
      {/* Bottom Row: Subtext or Horizontal scrolling details */}
      <div className="mt-1.5 w-full whitespace-nowrap overflow-x-auto no-scrollbar">
        {subText && (
          <p className="text-[9px] md:text-[10px] text-slate-500 leading-tight font-medium">{subText}</p>
        )}
        
        {details && details.length > 0 && (
          <div className="flex items-center gap-x-1.5 text-[9px] md:text-[10px] text-slate-500">
            {details.map((d, i) => (
              <span key={i} className="flex items-center shrink-0">
                <span className="tabular-nums font-bold text-slate-400">{d.value}</span>&nbsp;<span className="font-semibold text-slate-500">{d.label}</span>
                {i < details.length - 1 && <span className="ml-1.5 text-slate-700 font-bold">·</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
