import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { getFriendlyMessage } from '../../lib/errorUtils';
import { Save, UserCheck, UserX, Loader2, CheckCircle, XCircle, Check, X, UserPlus, Flame, ExternalLink, Share2, LayoutGrid, ChevronDown, Clock, AlertTriangle, Calendar, Globe, FileText, RotateCcw, Trash2 } from 'lucide-react';
import ImageModal from '../common/ImageModal';
import PersonActionModal from '../PersonActionModal';
import { fetchHierarchyData, fetchPositions } from '../../services/hierarchyService';
import { createFirstTimer } from '../../services/peopleService';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';
import NetRevelationExportModal from './NetRevelationExportModal';

// ─── Service Type Definitions ────────────────────────────────────────────────
const SERVICE_TYPES = [
  { value: 'Mega Gathering Service', label: 'Mega Gathering Service', days: [0, 6] }, // Sunday=0, Saturday=6
  { value: 'LC Live', label: 'LC Live', days: [3] }, // Wednesday=3
  { value: 'Special Meeting', label: 'Special Meeting', days: null }, // Any day
];

// ─── Date & Deadline Helpers ─────────────────────────────────────────────────
function getServiceDate(serviceValue, activeSpecialMeeting = null) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentDay = today.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

  if (serviceValue === 'Mega Gathering Service') {
    const result = new Date(today);
    // Sunday (0) maps to today, Monday (1) maps to yesterday. All other days map to the previous Sunday.
    result.setDate(result.getDate() - currentDay);
    return result;
  } else if (serviceValue === 'LC Live') {
    // LC Live is Wednesday.
    const result = new Date(today);
    if (currentDay >= 3 && currentDay <= 6) {
      // Wed to Sat: map to the Wed of this week
      result.setDate(result.getDate() - (currentDay - 3));
    } else {
      // Sun(0) to Tue(2): map to the PREVIOUS Wed
      // Sun(0): go back 4 days. Mon(1): go back 5 days. Tue(2): go back 6 days.
      result.setDate(result.getDate() - currentDay - 4);
    }
    return result;
  } else {
    // Special Meeting
    if (activeSpecialMeeting && activeSpecialMeeting.meeting_date) {
      const parts = activeSpecialMeeting.meeting_date.split('-');
      if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    return today;
  }
}

function getDeadline(serviceValue, serviceDate) {
  const deadline = new Date(serviceDate);
  if (serviceValue === 'Mega Gathering Service') {
    // 24 hours after Sunday = end of Monday (11:59:59 PM)
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(23, 59, 59, 999);
  } else if (serviceValue === 'LC Live') {
    // End of Saturday of that week
    // Wednesday + 3 days = Saturday
    deadline.setDate(deadline.getDate() + 3);
    deadline.setHours(23, 59, 59, 999);
  } else {
    // Special Meeting: 24 hours from the service date (end of next day)
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(23, 59, 59, 999);
  }
  return deadline;
}

function isDeadlinePassed(serviceValue, serviceDate) {
  const deadline = getDeadline(serviceValue, serviceDate);
  return new Date() > deadline;
}

function formatDateShort(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function toISODate(date) {
  // Returns YYYY-MM-DD in local time
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AttendanceMarking({ currentRole, overrideUnitId = null, overrideUnitType = null, overrideUnitName = null }) {
  const [serviceType, setServiceType] = useState('Mega Gathering Service');
  const [specialMeetingName, setSpecialMeetingName] = useState('');
  const [activeSpecialMeeting, setActiveSpecialMeeting] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [submittingConfig, setSubmittingConfig] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attendance, setAttendance] = useState({});
  const [firstTimers, setFirstTimers] = useState(0);
  const [soulsWon, setSoulsWon] = useState(0);
  const [activeUnitName, setActiveUnitName] = useState(currentRole.unitName);
  const [successMsg, setSuccessMsg] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successServiceInfo, setSuccessServiceInfo] = useState({ service: '', date: '' });
  const [imageModalConfig, setImageModalConfig] = useState({ isOpen: false, src: '', title: '' });
  const [hierarchyData, setHierarchyData] = useState([]);
  const [positions, setPositions] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  // Undo session state
  const [sessionId, setSessionId] = useState(null);
  const [sessionCreatedAt, setSessionCreatedAt] = useState(null);
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const isHighestRank = currentRole?.level === 1 || currentRole?.title === 'Branch Pastor';

  // Derived: compute the session date and deadline from serviceType
  const serviceDate = useMemo(() => getServiceDate(serviceType, activeSpecialMeeting), [serviceType, activeSpecialMeeting]);
  const date = useMemo(() => toISODate(serviceDate), [serviceDate]);
  const deadlinePassed = useMemo(() => isDeadlinePassed(serviceType, serviceDate), [serviceType, serviceDate]);
  const deadline = useMemo(() => getDeadline(serviceType, serviceDate), [serviceType, serviceDate]);
  
  const resolvedServiceName = serviceType === 'Special Meeting' 
    ? (specialMeetingName.startsWith('Special Meeting - ') ? specialMeetingName.trim() : `Special Meeting - ${specialMeetingName.trim()}`)
    : serviceType;
  const isSpecialMeetingInvalid = serviceType === 'Special Meeting' && !specialMeetingName.trim();

  const handleFirstTimersChange = (val) => {
    const newVal = Math.max(0, parseInt(val) || 0);
    setFirstTimers(newVal);
  };

  // Use overrideUnitId (when a higher-level leader picks a cell), else fall back to own unit
  const effectiveUnitId = overrideUnitId || currentRole.unitId;
  const effectiveUnitType = overrideUnitType || currentRole.unitType;
  
  const isDirectUnit = effectiveUnitId === currentRole.unitId;
  const canMark = isDirectUnit || currentRole.unitType === 'MC' || currentRole.unitType === 'BUSCENTA';
  const isGeneralMarkingLevel = ['CELL', 'MC', 'BUSCENTA'].includes(effectiveUnitType);

  const computedFirstTimersCount = useMemo(() => {
    return members
       .filter(m => m.membership_state === 'First Timer')
       .filter(m => attendance[m.id] === 'PRESENT' || attendance[m.id] === 'ONLINE')
       .length;
  }, [members, attendance]);

  useEffect(() => {
    fetchHierarchyData().then(setHierarchyData);
    fetchPositions().then(setPositions);

    async function fetchSpecialMeetingConfig() {
      try {
        const { data, error } = await supabase
          .from('special_meeting_config')
          .select('*')
          .order('meeting_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setActiveSpecialMeeting(data);
          setSpecialMeetingName(data.meeting_name);
        }
      } catch (err) {
        console.error("Error fetching special meeting config:", err);
        setConfigError(getFriendlyMessage(err, 'Failed to load special meeting config. Make sure the database migration has been applied.'));
      } finally {
        setLoadingConfig(false);
      }
    }
    fetchSpecialMeetingConfig();
  }, []);

  const handleSaveSpecialMeetingConfig = async () => {
    if (!specialMeetingName.trim()) {
      alert("Please enter a meeting name.");
      return;
    }
    const meetingDate = activeSpecialMeeting?.meeting_date || toISODate(new Date());
    setSubmittingConfig(true);
    try {
      const { data, error } = await supabase
        .from('special_meeting_config')
        .insert({
          meeting_name: specialMeetingName.trim(),
          meeting_date: meetingDate,
          created_by: currentRole.personId || null
        })
        .select()
        .single();

      if (error) throw error;
      setActiveSpecialMeeting(data);
      alert("Special Meeting configured successfully!");
    } catch (err) {
      console.error("Error configuring special meeting:", err);
      alert(getFriendlyMessage(err, 'Failed to configure Special Meeting. Please try again.'));
    } finally {
      setSubmittingConfig(false);
    }
  };

  const loadMembers = async (preserveLocal = false) => {
      if (!effectiveUnitId) return;
      
      setLoading(true);
      try {
        // If an override is active, first fetch that unit's actual name
        if (overrideUnitId) {
            const { data: uData } = await supabase
                .from('organizational_units')
                .select('name')
                .eq('id', overrideUnitId)
                .single();
            if (uData) setActiveUnitName(uData.name);
        } else {
            setActiveUnitName(currentRole.unitName);
        }

        // Fetch session first (if it exists)
        let existingRecords = {};
        if (effectiveUnitId && date && resolvedServiceName) {
            const { data: sessionData } = await supabase
                .from('attendance_sessions')
                .select('id, created_at')
                .eq('unit_id', effectiveUnitId)
                .eq('session_date', date)
                .eq('service_name', resolvedServiceName)
                .maybeSingle();

            if (sessionData) {
                setSessionId(sessionData.id);
                setSessionCreatedAt(sessionData.created_at);
                const { data: recordsData } = await supabase
                    .from('attendance_records')
                    .select('person_id, status')
                    .eq('session_id', sessionData.id);
                if (recordsData) {
                    recordsData.forEach(r => {
                        existingRecords[r.person_id] = r.status;
                    });
                }
            } else {
                setSessionId(null);
                setSessionCreatedAt(null);
            }
        }

        // Use unitId directly — no name-based lookup needed (fixes fragile query)
        const { data: memberData, error: memberError } = await supabase
          .from('position_assignments')
          .select(`
            person_id,
            people ( 
                id, 
                full_name, 
                photo_url, 
                is_active,
                created_at,
                attendance_records ( status )
            ),
            positions ( title )
          `)
          .eq('unit_id', effectiveUnitId)
          .eq('is_active', true);

        if (memberError) throw memberError;

        const formattedMembers = memberData
          .map(m => {
             const p = m.people;
             if (!p) return null;
             
             let historicalPresentCount = 0;
             if (p.attendance_records && p.attendance_records.length > 0) {
                 historicalPresentCount = p.attendance_records.filter(r => r.status === 'PRESENT').length;
                 // Subtract the current session's attendance if it's already saved, so we get strictly PAST attendance
                 if (existingRecords[p.id] === 'PRESENT') {
                     historicalPresentCount -= 1;
                 }
             }
             
             const roleTitle = m.positions?.title || 'Unassigned';
             let membership_state = roleTitle;

             // Pipeline ONLY applies to people registered as 'First Timer' (added from the attendance screen).
             // Anyone added via the directory with 'Cell Member', 'Member', or 'Unassigned' is already a
             // member and must always appear as 'Member', regardless of attendance count.
             if (roleTitle === 'First Timer') {
                 if (historicalPresentCount === 0) membership_state = 'First Timer';
                 else if (historicalPresentCount === 1 || historicalPresentCount === 2) membership_state = 'Brethren';
                 else if (historicalPresentCount >= 3) membership_state = 'Member';
             } else if (roleTitle === 'Cell Member' || roleTitle === 'Member' || roleTitle === 'Unassigned') {
                 membership_state = 'Member';
             }
             
             return { ...p, role: roleTitle, membership_state, present_count: historicalPresentCount };
          })
          .filter(p => p && p.is_active)
          .sort((a, b) => a.full_name.localeCompare(b.full_name));

        setMembers(formattedMembers);
        
        // Initialize status, preserving any unsaved local marks if requested
        setAttendance(prev => {
            const nextStatus = preserveLocal ? { ...prev } : {};
            formattedMembers.forEach(m => {
                if (!preserveLocal || nextStatus[m.id] === undefined) {
                    nextStatus[m.id] = existingRecords[m.id] !== undefined ? existingRecords[m.id] : null;
                }
            });
            return nextStatus;
        });

      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    loadMembers(false);
  }, [effectiveUnitId, date, resolvedServiceName]);

  // When service type changes, load existing session growth counts (if session exists)
  useEffect(() => {
    if (!effectiveUnitId || !date || !resolvedServiceName) return;
    async function loadSessionCounts() {
      const { data } = await supabase
        .from('attendance_sessions')
        .select('first_timers_count, souls_won_count')
        .eq('unit_id', effectiveUnitId)
        .eq('session_date', date)
        .eq('service_name', resolvedServiceName)
        .maybeSingle();
      if (data) {
        setFirstTimers(data.first_timers_count ?? 0);
        setSoulsWon(data.souls_won_count ?? 0);
      } else {
        setFirstTimers(0);
        setSoulsWon(0);
      }
    }
    loadSessionCounts();
  }, [effectiveUnitId, date, resolvedServiceName]);

  const toggleStatus = (personId) => {
    setAttendance(prev => ({
      ...prev,
      [personId]: prev[personId] === 'PRESENT' ? 'ABSENT' : 'PRESENT'
    }));
  };

  const handleSubmit = async () => {
    // Absolute server-side guard: prevents any non-CELL leader from submitting
    if (!canMark) {
        alert('Only Cell-level leaders can submit attendance.');
        return;
    }

    // Deadline guard
    if (deadlinePassed) {
        alert('The deadline for this service has passed. Attendance can no longer be submitted.');
        return;
    }

    // Special meeting name guard
    if (isSpecialMeetingInvalid) {
        alert('Please provide a name for the Special Meeting before submitting.');
        return;
    }
    
    setSubmitting(true);
    setSuccessMsg('');
    
    try {
        if (!effectiveUnitId) throw new Error("No unit selected");

        const { data: { user } } = await supabase.auth.getUser();

        const { data: sessionData, error: sessionError } = await supabase
            .from('attendance_sessions')
            .upsert({
                unit_id: effectiveUnitId,
                session_date: date,
                service_name: resolvedServiceName,
                created_by: currentRole.personId || null,
                first_timers_count: computedFirstTimersCount,
                souls_won_count: soulsWon,
            }, { onConflict: 'unit_id,session_date,service_name' })
            .select()
            .single();

        if (sessionError) throw sessionError;

        // Create Records
        const records = members.map(m => ({
            session_id: sessionData.id,
            person_id: m.id,
            status: attendance[m.id] || 'ABSENT'
        }));

        const { error: recordsError } = await supabase
            .from('attendance_records')
            .upsert(records, { onConflict: 'session_id,person_id' });

        if (recordsError) throw recordsError;

        // Invalidate people and hierarchy caches so that promotions/state changes are reflected
        cacheService.remove(CACHE_KEYS.PEOPLE);
        cacheService.remove(CACHE_KEYS.HIERARCHY);

        setSuccessServiceInfo({ service: resolvedServiceName, date: formatDateShort(serviceDate) });
        setShowSuccessModal(true);

    } catch (error) {
        console.error("Error submitting attendance:", error);
        alert(getFriendlyMessage(error, 'Attendance could not be submitted. Please try again.'));
    } finally {
        setSubmitting(false);
    }
  };

  // ── Undo Session ─────────────────────────────────────────────────────────────
  const ADMIN_ROLES = ['Branch Pastor', 'Alpha Branch Pastor', 'Church Head', 'MC Head', 'Buscenta Head', 'Assembly Head', 'MC Live Head'];
  const isAdmin = isHighestRank || ADMIN_ROLES.includes(currentRole?.title);
  const sessionAgeHours = sessionCreatedAt
    ? (Date.now() - new Date(sessionCreatedAt).getTime()) / (1000 * 60 * 60)
    : Infinity;
  // For Special Meetings, allow undo any time within the deadline window (same as marking).
  // For other services, keep the 24-hour session-age rule.
  const withinDeadline = !isDeadlinePassed(serviceType, serviceDate);
  const canUndoSession = !!sessionId && (isAdmin || (canMark && (serviceType === 'Special Meeting' ? withinDeadline : sessionAgeHours <= 24)));
  const undoBlockedReason = !!sessionId && !canUndoSession
    ? 'The undo window has passed. Contact an admin to undo this session.'
    : null;

  const handleUndoSession = async () => {
    if (!canUndoSession || !sessionId) return;
    setUndoing(true);
    try {
      // Delete the session — attendance_records should cascade delete via FK
      const { error } = await supabase
        .from('attendance_sessions')
        .delete()
        .eq('id', sessionId);
      if (error) throw error;

      // Invalidate caches
      cacheService.remove(CACHE_KEYS.PEOPLE);
      cacheService.remove(CACHE_KEYS.HIERARCHY);

      // Reset local state and reload
      setSessionId(null);
      setSessionCreatedAt(null);
      setAttendance({});
      setFirstTimers(0);
      setSoulsWon(0);
      setShowUndoModal(false);
      await loadMembers(false);
    } catch (err) {
      console.error('Error undoing session:', err);
      alert(getFriendlyMessage(err, 'The session could not be undone. Please try again.'));
    } finally {
      setUndoing(false);
    }
  };

  // If not a cell, we render them in view-only mode
  return (
    <div className="space-y-6">

      {/* Config Error Banner — shown if special_meeting_config table doesn't exist in DB */}
      {configError && (
        <div className="p-4 bg-rose-950/30 border border-rose-500/40 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm font-black text-rose-300">Special Meeting Config Error</p>
            <p className="text-xs text-rose-300/80 font-semibold mt-1">
              The <code className="bg-rose-900/40 px-1 rounded">special_meeting_config</code> table doesn't exist yet.
              Please run the database migration SQL in Supabase → SQL Editor.
            </p>
          </div>
        </div>
      )}

      {/* Service Selector */}
      <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 uppercase font-black tracking-wider">Service Type</label>
              <div className="relative">
                  <LayoutGrid className="absolute left-4 top-1/2 -translate-y-1/2 text-church-blue-400 pointer-events-none" size={18} />
                  <select
                      value={serviceType}
                      onChange={(e) => { 
                          const val = e.target.value;
                          setServiceType(val); 
                          if (val === 'Special Meeting' && activeSpecialMeeting) {
                              setSpecialMeetingName(activeSpecialMeeting.meeting_name);
                          } else {
                              setSpecialMeetingName(''); 
                          }
                      }}
                      style={{ backgroundColor: '#0f172a' }}
                      className="w-full border border-slate-600/60 rounded-2xl pl-12 pr-10 py-3.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-church-blue-500/50 focus:border-church-blue-500/50 transition-colors appearance-none [color-scheme:dark]"
                  >
                      {SERVICE_TYPES.map(st => {
                          let label = st.label;
                          if (st.value === 'Special Meeting' && activeSpecialMeeting?.meeting_name) {
                              label = `Special Meeting - ${activeSpecialMeeting.meeting_name}`;
                          }
                          return (
                              <option key={st.value} value={st.value} style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>{label}</option>
                          );
                      })}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
              </div>
          </div>

          {/* Admin Special Meeting Configuration Card (for Highest Rank only) */}
          {serviceType === 'Special Meeting' && isHighestRank && (
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                      <Flame className="text-church-blue-400 animate-pulse" size={20} />
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Configure Special Meeting</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                      As the highest-ranking leader, you can set the name and date for the upcoming Special Meeting. This locks the configuration for all shepherds.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Meeting Name <span className="text-church-coral-400">*</span></label>
                          <input
                              type="text"
                              value={specialMeetingName}
                              onChange={(e) => setSpecialMeetingName(e.target.value)}
                              placeholder="e.g. Belivers' Convention"
                              className="w-full bg-[#0f172a] border border-slate-600/60 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-church-blue-500/50"
                          />
                      </div>
                      <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Meeting Date</label>
                          <input
                              type="date"
                              value={activeSpecialMeeting?.meeting_date || toISODate(new Date())}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  setActiveSpecialMeeting(prev => ({
                                      ...prev,
                                      meeting_date: val
                                  }));
                              }}
                              className="w-full bg-[#0f172a] border border-slate-600/60 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-church-blue-500/50"
                          />
                      </div>
                  </div>
                  <div className="flex justify-end">
                      <button
                          type="button"
                          onClick={handleSaveSpecialMeetingConfig}
                          disabled={submittingConfig}
                          className="bg-church-blue-600 hover:bg-church-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5"
                      >
                          {submittingConfig ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                          Save Configuration
                      </button>
                  </div>
              </div>
          )}

          {/* Locked Special Meeting Banner for Normal Shepherds */}
          {serviceType === 'Special Meeting' && !isHighestRank && activeSpecialMeeting && (
              <div className="bg-slate-800/20 border border-slate-700/40 rounded-2xl p-4 flex items-center gap-3">
                  <Globe className="text-church-blue-400" size={20} />
                  <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Active Special Meeting</p>
                      <p className="text-sm font-black text-white">{activeSpecialMeeting.meeting_name}</p>
                      <p className="text-[11px] text-slate-500 font-semibold">Held on {formatDateShort(serviceDate)} (locked by leadership)</p>
                  </div>
              </div>
          )}

          {/* Warning Banner if No Special Meeting Configured */}
          {serviceType === 'Special Meeting' && !isHighestRank && !activeSpecialMeeting && (
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                  <div>
                      <h4 className="text-sm font-black text-amber-400">No Special Meeting Configured</h4>
                      <p className="text-xs text-amber-300/80 leading-relaxed font-semibold mt-1">
                          No active Special Meeting has been configured by church leadership. Please contact the Branch Pastor to configure the meeting details before marking attendance.
                      </p>
                  </div>
              </div>
          )}

          {/* Auto-computed date & deadline info */}
          <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                  <Calendar size={12} className="text-slate-600" />
                  <span>{formatDateShort(serviceDate)}</span>
              </div>
              {deadlinePassed ? (
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-church-coral-400 uppercase tracking-wider">
                      <XCircle size={12} /> Deadline Passed
                  </div>
              ) : (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                      <Clock size={12} /> Closes {deadline.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
              )}
          </div>
      </div>

      {/* Deadline Passed Banner */}
      {deadlinePassed && canMark && (
          <div className="flex items-start gap-3 border border-church-coral-500/30 bg-church-coral-500/5 rounded-2xl p-4">
              <AlertTriangle size={20} className="text-church-coral-400 shrink-0 mt-0.5" />
              <p className="text-sm text-church-coral-300 font-medium leading-relaxed">
                  The submission window for <span className="font-black">{serviceType}</span> ({formatDateShort(serviceDate)}) has closed. You can no longer mark attendance for this service.
              </p>
          </div>
      )}



      {/* Member List */}
      {!(serviceType === 'Special Meeting' && !activeSpecialMeeting && !isHighestRank) && (
      <>
      <div className="mb-8">
        {loading ? (
            <div className="p-12 flex justify-center">
                <Loader2 className="animate-spin text-church-blue-500" size={40} />
            </div>
        ) : members.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-semibold">
                No members found in this cell.
            </div>
        ) : (
            <div className="space-y-10">
                {/* ── Core Members Arena ── */}
                <div>
                    <div className="space-y-2">
                        {members.filter(m => !['First Timer', 'Brethren'].includes(m.membership_state)).length === 0 ? (
                            <div className="py-8 text-center text-slate-500 font-semibold italic text-sm border-t border-slate-700/50">No core members to display.</div>
                        ) : members.filter(m => !['First Timer', 'Brethren'].includes(m.membership_state)).map(member => (
                            <div key={member.id} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border border-slate-700/40 hover:border-slate-600/60 hover:bg-white/[0.01] transition-all">
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* Avatar/Photo */}
                                    <div 
                                        onClick={() => member.photo_url && setImageModalConfig({ isOpen: true, src: member.photo_url, title: member.full_name })}
                                        className={`w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-white/5 shadow-sm transition-transform hover:scale-105 ${member.photo_url ? 'cursor-pointer' : ''}`}
                                    >
                                        {member.photo_url ? (
                                            <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <UserCheck size={18} className="text-slate-500" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-slate-200 text-sm md:text-base truncate leading-snug">{member.full_name}</span>
                                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                                            {/* Placeholder badge */}
                                            {member.is_placeholder && (
                                                <div className="text-[7px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-0.5">
                                                    <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></span> Virtual Placeholder
                                                </div>
                                            )}

                                            {/* Role title — single blue badge only */}
                                            {member.role && member.role !== 'Unassigned' && (
                                                <span className="text-church-blue-400 font-black text-[8px] uppercase tracking-wider">{member.role}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Present/Online/Absent actions */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        disabled={!canMark || !!sessionId}
                                        onClick={() => setAttendance(prev => ({ ...prev, [member.id]: attendance[member.id] === 'PRESENT' ? null : 'PRESENT' }))}
                                        className={`w-7 h-7 md:w-8 md:h-8 rounded-full transition-all flex items-center justify-center disabled:cursor-not-allowed ${
                                            attendance[member.id] === 'PRESENT'
                                                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-500/30 font-bold'
                                                : 'bg-transparent text-slate-600 hover:bg-slate-800/50 hover:text-slate-300 disabled:opacity-30'
                                        }`}
                                        title="Mark Present"
                                    >
                                        <Check size={16} strokeWidth={attendance[member.id] === 'PRESENT' ? 3 : 2} />
                                    </button>
                                    <button
                                        disabled={!canMark || !!sessionId}
                                        onClick={() => setAttendance(prev => ({ ...prev, [member.id]: attendance[member.id] === 'ONLINE' ? null : 'ONLINE' }))}
                                        className={`w-7 h-7 md:w-8 md:h-8 rounded-full transition-all flex items-center justify-center disabled:cursor-not-allowed ${
                                            attendance[member.id] === 'ONLINE'
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 font-bold'
                                                : 'bg-transparent text-slate-600 hover:bg-slate-800/50 hover:text-slate-300 disabled:opacity-30'
                                        }`}
                                        title="Mark Online"
                                    >
                                        <Globe size={15} strokeWidth={attendance[member.id] === 'ONLINE' ? 3 : 2} />
                                    </button>
                                    <button
                                        disabled={!canMark || !!sessionId}
                                        onClick={() => setAttendance(prev => ({ ...prev, [member.id]: attendance[member.id] === 'ABSENT' ? null : 'ABSENT' }))}
                                        className={`w-7 h-7 md:w-8 md:h-8 rounded-full transition-all flex items-center justify-center disabled:cursor-not-allowed ${
                                            attendance[member.id] === 'ABSENT'
                                                ? 'bg-rose-700 text-white shadow-md shadow-rose-500/30 font-bold'
                                                : 'bg-transparent text-slate-600 hover:bg-slate-800/50 hover:text-slate-300 disabled:opacity-30'
                                        }`}
                                        title="Mark Absent"
                                    >
                                        <X size={16} strokeWidth={attendance[member.id] === 'ABSENT' ? 3 : 2} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Growth & Staging Arena ── */}
                {canMark && isGeneralMarkingLevel && (
                    <div id="first-timers-section" className="mt-8 pt-8 border-t-4 border-dashed border-slate-700/30 relative">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#0a0a0b] px-4 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase rounded-full">
                            Growth Additions
                        </div>
                        
                        <div className="flex items-center justify-between mb-4 px-2">
                            <h3 className="text-sm font-black text-church-blue-400/80 uppercase tracking-widest">First Timers</h3>
                            <button 
                                disabled={!canMark}
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase text-white bg-church-blue-600/20 hover:bg-church-blue-600/40 py-2 px-4 rounded-xl transition-colors border border-church-blue-500/30 shadow-inner disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <UserPlus size={14} /> Register New
                            </button>
                        </div>

                        <div className="space-y-2">
                            {members.filter(m => ['First Timer', 'Brethren'].includes(m.membership_state)).length === 0 ? (
                                <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center font-semibold italic text-sm">
                                    <UserPlus size={32} className="text-slate-600 mb-3" />
                                    No staging members tracking currently.
                                </div>
                            ) : members.filter(m => ['First Timer', 'Brethren'].includes(m.membership_state)).map(member => (
                                <div key={member.id} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border border-slate-700/40 hover:border-slate-600/60 hover:bg-white/[0.01] transition-all">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {/* Avatar/Photo */}
                                        <div 
                                            onClick={() => member.photo_url && setImageModalConfig({ isOpen: true, src: member.photo_url, title: member.full_name })}
                                            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-white/5 shadow-sm transition-transform hover:scale-105 ${member.photo_url ? 'cursor-pointer' : ''}`}
                                        >
                                            {member.photo_url ? (
                                                <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <UserCheck size={18} className="text-slate-500" />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-bold text-slate-200 text-sm md:text-base truncate leading-snug">{member.full_name}</span>
                                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                                                {/* Placeholder badge */}
                                                {member.is_placeholder && (
                                                    <div className="text-[7px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-0.5">
                                                        <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></span> Virtual Placeholder
                                                    </div>
                                                )}

                                                {/* Role title — single blue badge only */}
                                                {member.role && member.role !== 'Unassigned' && (
                                                    <span className="text-church-blue-400 font-black text-[8px] uppercase tracking-wider">{member.role}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Present/Online/Absent actions */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            disabled={!canMark || !!sessionId}
                                            onClick={() => setAttendance(prev => ({ ...prev, [member.id]: attendance[member.id] === 'PRESENT' ? null : 'PRESENT' }))}
                                            className={`w-7 h-7 md:w-8 md:h-8 rounded-full transition-all flex items-center justify-center disabled:cursor-not-allowed ${
                                                attendance[member.id] === 'PRESENT'
                                                    ? 'bg-emerald-700 text-white shadow-md shadow-emerald-500/30 font-bold'
                                                    : 'bg-transparent text-slate-600 hover:bg-slate-800/50 hover:text-slate-300 disabled:opacity-30'
                                            }`}
                                            title="Mark Present"
                                        >
                                            <Check size={16} strokeWidth={attendance[member.id] === 'PRESENT' ? 3 : 2} />
                                        </button>
                                        <button
                                            disabled={!canMark || !!sessionId}
                                            onClick={() => setAttendance(prev => ({ ...prev, [member.id]: attendance[member.id] === 'ONLINE' ? null : 'ONLINE' }))}
                                            className={`w-7 h-7 md:w-8 md:h-8 rounded-full transition-all flex items-center justify-center disabled:cursor-not-allowed ${
                                                attendance[member.id] === 'ONLINE'
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 font-bold'
                                                    : 'bg-transparent text-slate-600 hover:bg-slate-800/50 hover:text-slate-300 disabled:opacity-30'
                                            }`}
                                            title="Mark Online"
                                        >
                                            <Globe size={15} strokeWidth={attendance[member.id] === 'ONLINE' ? 3 : 2} />
                                        </button>
                                        <button
                                            disabled={!canMark || !!sessionId}
                                            onClick={() => setAttendance(prev => ({ ...prev, [member.id]: attendance[member.id] === 'ABSENT' ? null : 'ABSENT' }))}
                                            className={`w-7 h-7 md:w-8 md:h-8 rounded-full transition-all flex items-center justify-center disabled:cursor-not-allowed ${
                                                attendance[member.id] === 'ABSENT'
                                                    ? 'bg-rose-700 text-white shadow-md shadow-rose-500/30 font-bold'
                                                    : 'bg-transparent text-slate-600 hover:bg-slate-800/50 hover:text-slate-300 disabled:opacity-30'
                                            }`}
                                            title="Mark Absent"
                                        >
                                            <X size={16} strokeWidth={attendance[member.id] === 'ABSENT' ? 3 : 2} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Bottom Controls */}
      {canMark && (
          <div className={`flex flex-col md:flex-row md:items-center ${isGeneralMarkingLevel ? 'justify-between' : 'justify-end'} gap-6 py-6 border-t border-white/5 mt-8`}>
            {isGeneralMarkingLevel && (
                <div className="flex flex-col sm:flex-row gap-6 w-full md:w-auto">
                {/* Flatter Minimal Mobile-Responsive Growth Counters */}
                <div className="flex flex-col w-full sm:w-auto min-w-[170px] border-b border-slate-700/50 pb-3">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-slate-200">
                                <UserPlus size={18} className="text-blue-700" />
                                <span className="text-sm font-bold tracking-wide">First Timers</span>
                            </div>
                            <input
                                type="number"
                                readOnly
                                value={computedFirstTimersCount || firstTimers || ''}
                                className="w-16 bg-slate-900/80 border border-blue-700/20 rounded-lg px-2 py-1 text-white text-center font-black text-xl placeholder:text-slate-600 transition-all shadow-inner opacity-70 cursor-not-allowed"
                                placeholder="0"
                                title="Auto-calculated from staging arena above"
                            />
                        </div>
                        <button 
                            onClick={() => window.open('https://forms.gle/oJQiSv6M4xmXzPZ99', '_blank')}
                            className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-blue-700 hover:bg-blue-700/10 hover:text-blue-400 px-2 py-1 -ml-2 rounded-md transition-colors w-fit"
                        >
                            <ExternalLink size={12} /> Open Form
                        </button>
                    </div>
                </div>

                <div className="flex flex-col w-full sm:w-auto min-w-[170px] border-b border-slate-800/50 pb-3">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-slate-200">
                                <Flame size={18} className="text-blue-700" />
                                <span className="text-sm font-bold tracking-wide">Souls Won</span>
                            </div>
                            <input
                                type="number"
                                min={0}
                                value={soulsWon === 0 ? '' : soulsWon}
                                onChange={(e) => setSoulsWon(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-16 bg-slate-900/80 border border-blue-700/50 rounded-lg px-2 py-1 text-white text-center font-black text-xl focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600 transition-all shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                            />
                        </div>
                        <button 
                            onClick={() => window.open('https://forms.gle/BjsoPe2F2KjqFn3o8', '_blank')}
                            className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-blue-700 hover:bg-blue-700/10 hover:text-blue-400 px-2 py-1 -ml-2 rounded-md transition-colors w-fit"
                        >
                            <ExternalLink size={12} /> Open Form
                        </button>
                    </div>
                </div>
            </div>
            )}

            <div className="flex gap-2 w-full md:w-auto flex-wrap">
              {['Alpha Branch Pastor', 'Church Head', 'MC Head', 'Buscenta Head'].includes(currentRole?.title) && (
                  <button 
                      type="button"
                      onClick={() => setIsExportModalOpen(true)}
                      disabled={loading || submitting}
                      className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-transparent border border-slate-600/60 hover:border-indigo-500/60 hover:bg-indigo-500/5 text-slate-400 hover:text-indigo-300 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                      <FileText size={14} />
                      <span>Net Revelation</span>
                  </button>
              )}

              {/* Undo Session Button — shown only when a session exists */}
              {sessionId && (
                <button
                  type="button"
                  onClick={() => canUndoSession ? setShowUndoModal(true) : alert(undoBlockedReason)}
                  disabled={undoing || submitting || loading}
                  title={undoBlockedReason || 'Undo this attendance session'}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 border px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                    canUndoSession
                      ? 'border-rose-500/40 hover:border-rose-500/70 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300'
                      : 'border-slate-700/40 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {undoing ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                  <span>{undoing ? 'Undoing...' : 'Undo Session'}</span>
                </button>
              )}

              <button 
                  onClick={handleSubmit}
                  disabled={!canMark || submitting || loading || deadlinePassed || isSpecialMeetingInvalid || !!sessionId}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-gradient-church hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-church-blue-500/20 disabled:opacity-50 disabled:bg-none disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700/50 disabled:shadow-none disabled:cursor-not-allowed whitespace-nowrap"
              >
                  {submitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  <span>{submitting ? 'Saving...' : 'Submit Attendance'}</span>
              </button>
            </div>
          </div>
       )}
      </>
      )}

      {/* Admin Undo button — visible when admin is scoped to another unit (canMark=false) but a session exists */}
      {!canMark && (isAdmin || isHighestRank) && sessionId && (
        <div className="flex justify-end pt-6 border-t border-white/5 mt-4">
          <button
            type="button"
            onClick={() => canUndoSession ? setShowUndoModal(true) : alert(undoBlockedReason)}
            disabled={undoing || loading}
            className="flex items-center justify-center gap-1.5 border border-rose-500/40 hover:border-rose-500/70 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {undoing ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
            <span>{undoing ? 'Undoing...' : 'Undo Session'}</span>
          </button>
        </div>
      )}

      <ImageModal 
                isOpen={imageModalConfig.isOpen}
                onClose={() => setImageModalConfig(prev => ({ ...prev, isOpen: false }))}
                imageSrc={imageModalConfig.src}
                title={imageModalConfig.title}
      />

      {/* Registration Modal */}
      <PersonActionModal 
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          mode="add"
          units={hierarchyData}
          positions={positions}
          // Intelligently pre-fill with the currently active unit when creating here!
          person={{ unit_id: effectiveUnitId }}
          lockUnit={true}  // Prevent altering the scope when rapid-adding from this screen
          onSubmit={async (data) => {
              // Create the person directly (No auth login generated)
              const newPerson = await createFirstTimer(data);
              // Upon success, gracefully close and immediately reload the members into the arena
              setIsAddModalOpen(false);
              setSuccessMsg('Member registered successfully!');
              setTimeout(() => setSuccessMsg(''), 3000);
              await loadMembers();
              // Automatically check them present as a convenience!
              setAttendance(prev => ({ ...prev, [newPerson.person.id]: 'PRESENT' }));
          }}
      />
      {/* Net Revelation Export Modal */}
      <NetRevelationExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        selectedSessionKey={`${date}_${resolvedServiceName}`}
        currentRole={currentRole}
        overrideUnitId={overrideUnitId}
        overrideUnitType={overrideUnitType}
        overrideUnitName={overrideUnitName}
      />

      {/* Attendance Submitted Success Modal */}
      {showSuccessModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowSuccessModal(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div
            className="relative w-full max-w-xs sm:max-w-sm bg-[#0d1117] border border-white/8 rounded-2xl p-5 shadow-2xl flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle size={22} className="text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-slate-100 leading-snug">Attendance Submitted</p>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">{successServiceInfo.service}</p>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5">{successServiceInfo.date}</p>
            </div>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Undo Session Confirmation Modal */}
      {showUndoModal && (
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
                This will permanently delete the <span className="text-white font-black">{resolvedServiceName}</span> session for <span className="text-white font-black">{activeUnitName}</span> on <span className="text-white font-black">{formatDateShort(serviceDate)}</span>.
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
