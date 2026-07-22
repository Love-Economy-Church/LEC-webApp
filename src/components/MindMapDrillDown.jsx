import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { fetchHierarchyData } from "../services/hierarchyService";
import { buildTree } from "../utils/treeUtils";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Users, Home } from "lucide-react";

// ==========================================
// COLOR THEMES — one per MC column
// Defined with split-shading properties, active glow states, and borders.
// ==========================================
const MC_THEMES = [
  {
    // 1 — Violet (Agape MC)
    namePlateBg: "bg-violet-900/90",
    darkTint: "bg-violet-950/50",
    lightTint: "bg-violet-950/10",
    textColor: "text-violet-400",
    accentText: "text-violet-300",
    buscentaBg: "bg-violet-950/30 border-violet-500/20",
    buscentaActiveBg: "bg-violet-900/60 border-violet-400/60 text-white",
    cellBg: "bg-violet-950/20 border-violet-500/15",
    cellActiveBg: "bg-violet-900/50 border-violet-400/55 text-white",
    shepherdBg: "bg-violet-950/45 border-violet-500/25 text-violet-200",
    memberBg: "bg-violet-950/20 border-violet-500/15 text-slate-200",
    activeGlow: "shadow-[0_0_20px_rgba(139,92,246,0.15)] border-violet-500/30",
    panelBgColor: "#110726",
    panelBorderColor: "rgba(139, 92, 246, 0.25)",
  },
  {
    // 2 — Rose (Dunamis MC)
    namePlateBg: "bg-rose-900/90",
    darkTint: "bg-rose-950/50",
    lightTint: "bg-rose-950/10",
    textColor: "text-rose-400",
    accentText: "text-rose-300",
    buscentaBg: "bg-rose-950/30 border-rose-500/20",
    buscentaActiveBg: "bg-rose-900/60 border-rose-400/60 text-white",
    cellBg: "bg-rose-950/20 border-rose-500/15",
    cellActiveBg: "bg-rose-900/50 border-rose-400/55 text-white",
    shepherdBg: "bg-rose-950/45 border-rose-500/25 text-rose-200",
    memberBg: "bg-rose-950/20 border-rose-500/15 text-slate-200",
    activeGlow: "shadow-[0_0_20px_rgba(244,63,94,0.15)] border-rose-500/30",
    panelBgColor: "#200512",
    panelBorderColor: "rgba(244, 63, 94, 0.25)",
  },
  {
    // 3 — Black (Media SM)
    namePlateBg: "bg-black",
    darkTint: "bg-neutral-900/60",
    lightTint: "bg-neutral-950/15",
    textColor: "text-zinc-400",
    accentText: "text-zinc-200",
    buscentaBg: "bg-zinc-900/40 border-zinc-800/30",
    buscentaActiveBg: "bg-zinc-800/60 border-zinc-600/60 text-white",
    cellBg: "bg-zinc-900/30 border-zinc-800/20",
    cellActiveBg: "bg-zinc-800/50 border-zinc-600/50 text-white",
    shepherdBg: "bg-zinc-950/45 border-zinc-800/25 text-zinc-300",
    memberBg: "bg-zinc-950/20 border-zinc-800/10 text-zinc-400",
    activeGlow: "shadow-[0_0_20px_rgba(255,255,255,0.05)] border-zinc-700/30",
    panelBgColor: "#0c0c0e",
    panelBorderColor: "rgba(63, 63, 70, 0.25)",
  },
  {
    // 4 — Blue (New Testament MC)
    namePlateBg: "bg-blue-900/90",
    darkTint: "bg-blue-950/50",
    lightTint: "bg-blue-950/10",
    textColor: "text-blue-400",
    accentText: "text-blue-300",
    buscentaBg: "bg-blue-950/30 border-blue-500/20",
    buscentaActiveBg: "bg-blue-900/60 border-blue-400/60 text-white",
    cellBg: "bg-blue-950/20 border-blue-500/15",
    cellActiveBg: "bg-blue-900/50 border-blue-400/55 text-white",
    shepherdBg: "bg-blue-950/45 border-blue-500/25 text-blue-200",
    memberBg: "bg-blue-950/20 border-blue-500/15 text-slate-200",
    activeGlow: "shadow-[0_0_20px_rgba(59,130,246,0.15)] border-blue-500/30",
    panelBgColor: "#060e24",
    panelBorderColor: "rgba(59, 130, 246, 0.25)",
  },
  {
    // 5 — Amber/Brown (Soul Winners' MC)
    namePlateBg: "bg-amber-950/90",
    darkTint: "bg-amber-950/45",
    lightTint: "bg-amber-950/10",
    textColor: "text-amber-500",
    accentText: "text-amber-400",
    buscentaBg: "bg-amber-950/25 border-amber-900/20",
    buscentaActiveBg: "bg-amber-900/50 border-amber-500/50 text-white",
    cellBg: "bg-amber-950/15 border-amber-900/15",
    cellActiveBg: "bg-amber-900/40 border-amber-500/45 text-white",
    shepherdBg: "bg-amber-950/35 border-amber-900/20 text-amber-300",
    memberBg: "bg-amber-950/15 border-amber-900/15 text-slate-200",
    activeGlow: "shadow-[0_0_20px_rgba(245,158,11,0.12)] border-amber-600/30",
    panelBgColor: "#1a0d05",
    panelBorderColor: "rgba(245, 158, 11, 0.25)",
  },
  {
    // 6 — Emerald (Fallback)
    namePlateBg: "bg-emerald-900/90",
    darkTint: "bg-emerald-950/50",
    lightTint: "bg-emerald-950/10",
    textColor: "text-emerald-400",
    accentText: "text-emerald-300",
    buscentaBg: "bg-emerald-950/30 border-emerald-500/20",
    buscentaActiveBg: "bg-emerald-600/30 border-emerald-400/60 text-white",
    cellBg: "bg-emerald-950/20 border-emerald-500/15",
    cellActiveBg: "bg-emerald-600/30 border-emerald-400/60 text-white",
    shepherdBg: "bg-emerald-950/45 border-emerald-500/25 text-emerald-200",
    memberBg: "bg-emerald-950/20 border-emerald-500/15 text-slate-200",
    activeGlow: "shadow-[0_0_20px_rgba(16,185,129,0.15)] border-emerald-500/30",
    panelBgColor: "#03170e",
    panelBorderColor: "rgba(16, 185, 129, 0.25)",
  },
];

// ==========================================
// AVATAR — full-face photo or initial
// ==========================================
function Avatar({ person, size = "md", accent = "border-white/20" }) {
  const dims =
    size === "xl"
      ? "w-20 h-20"
      : size === "lg"
      ? "w-16 h-16"
      : size === "sm"
      ? "w-8 h-8"
      : "w-11 h-11";
  const textSize =
    size === "xl"
      ? "text-2xl"
      : size === "lg"
      ? "text-xl"
      : size === "sm"
      ? "text-[10px]"
      : "text-base";
  if (!person) return null;
  const initial = (person.name || person.full_name || "?")
    .charAt(0)
    .toUpperCase();
  return (
    <div
      className={`${dims} rounded-full border-2 ${accent} overflow-hidden bg-slate-800 flex items-center justify-center shrink-0 shadow-lg`}
    >
      {person.photo || person.photo_url ? (
        <img
          src={person.photo || person.photo_url}
          alt={person.name}
          className="w-full h-full object-cover"
          style={{ objectPosition: "center 20%" }}
        />
      ) : (
        <span className={`font-black ${textSize} text-slate-300`}>
          {initial}
        </span>
      )}
    </div>
  );
}

// ==========================================
// HELPERS
// ==========================================

function countDescendantMembers(node) {
  const direct = node.members?.length || 0;
  const fromChildren = (node.children || []).reduce(
    (sum, child) => sum + countDescendantMembers(child),
    0
  );
  return direct + fromChildren;
}

function getRoleLabel(unitType) {
  switch (unitType) {
    case "BRANCH":   return "ALPHA BRANCH PASTOR";
    case "CHURCH":   return "CHURCH HEAD";
    case "MC":       return "MC HEAD";
    case "BUSCENTA": return "BUSCENTA HEAD";
    case "CELL":     return "CELL SHEPHERD";
    default:         return "LEADER";
  }
}

function getChildLabel(unit) {
  let type = typeof unit === 'string' ? unit : unit?.unit_type;
  let children = typeof unit === 'object' ? unit?.children : null;

  if (children && children.length > 0) {
    const childType = children[0].unit_type;
    switch (childType) {
      case "BRANCH":   return "BRANCHES";
      case "CHURCH":   return "CHURCHES";
      case "MC":       return "MCS";
      case "BUSCENTA": return "BUSCENTAS";
      case "CELL":     return "CELLS";
    }
  }

  switch (type) {
    case "BRANCH":   return "CHURCHES";
    case "CHURCH":   return "MCS";
    case "MC":       return "BUSCENTAS";
    case "BUSCENTA": return "CELLS";
    case "CELL":     return "MEMBERS";
    default:         return "UNITS";
  }
}

function getUnitChildPlural(unit, count) {
  let childType = 'CELL';
  if (unit?.children && unit.children.length > 0) {
    childType = unit.children[0].unit_type;
  } else {
    switch (unit?.unit_type) {
      case 'BRANCH':   childType = 'CHURCH'; break;
      case 'CHURCH':   childType = 'MC'; break;
      case 'MC':       childType = 'BUSCENTA'; break;
      case 'BUSCENTA': childType = 'CELL'; break;
      case 'CELL':     childType = 'MEMBER'; break;
      default:         childType = 'CELL';
    }
  }

  let singular = 'CELL';
  let plural = 'CELLS';

  switch (childType) {
    case 'BRANCH':   singular = 'BRANCH';   plural = 'BRANCHES'; break;
    case 'CHURCH':   singular = 'CHURCH';   plural = 'CHURCHES'; break;
    case 'MC':       singular = 'MC';       plural = 'MCS'; break;
    case 'BUSCENTA': singular = 'BUSCENTA'; plural = 'BUSCENTAS'; break;
    case 'CELL':     singular = 'CELL';     plural = 'CELLS'; break;
    case 'MEMBER':   singular = 'MEMBER';   plural = 'MEMBERS'; break;
    default:         singular = 'UNIT';     plural = 'UNITS';
  }

  const label = count === 1 ? singular : plural;
  return `${count} ${label}`;
}

function getPrimaryCellShepherd(unit) {
  const leaders = unit.leaders || [];
  return leaders.find(l => l.role?.toLowerCase() === 'cell shepherd') || null;
}

function getCellPeople(unit) {
  const list = [];
  const leaders = unit.leaders || [];
  const primary = getPrimaryCellShepherd(unit);
  const primaryId = primary?.id || primary?.person_id;

  leaders.forEach(l => {
    const lId = l.id || l.person_id;
    if (primaryId && lId === primaryId) return;
    list.push({
      ...l,
      isShepherd: true,
      displayRole: 'Shepherd'
    });
  });

  const members = unit.members || [];
  members.forEach(m => {
    list.push({
      ...m,
      isShepherd: false,
      displayRole: 'Member'
    });
  });

  return list;
}

// ==========================================
// MC ITEM — clickable row inside a church/zone column
// ==========================================
function MCItem({ mc, theme, isSelected, onSelect, selectedBuscentaId, onBuscentaSelect, drillPanelRef }) {
  const leader = mc.leaders?.[0];
  const buscentaCount = mc.children?.length || 0;
  const memberCount = countDescendantMembers(mc);
  return (
    <div className="relative w-full">
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-left border transition-all duration-300 shadow-sm ${
          isSelected
            ? `${theme.buscentaActiveBg} ${theme.activeGlow} scale-[1.01]`
            : `${theme.buscentaBg} border-white/5 hover:border-white/20 hover:bg-slate-800/40 hover:scale-[1.01]`
        }`}
      >
        <Avatar person={leader} size="sm" accent="border-white/10" />
        <div className="min-w-0 flex-1">
          <h5 className="text-[10px] font-black text-white leading-tight uppercase tracking-tight truncate">
            {leader?.name || 'No Leader'}
          </h5>
          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 truncate">
            {mc.name}
          </p>
          <div className="flex items-center gap-3 mt-1">
            {buscentaCount > 0 && (
              <span className="text-[8px] text-slate-400 flex items-center gap-1 font-bold">
                <Home size={8} className="shrink-0" />
                <span className="font-black text-white">{buscentaCount}</span>
              </span>
            )}
            <span className="text-[8px] text-slate-400 flex items-center gap-1 font-bold">
              <Users size={8} className="shrink-0" />
              <span className="font-black text-white">{memberCount}</span>
            </span>
          </div>
        </div>
        <ChevronRight
          size={10}
          className={`text-slate-600 transition-transform duration-300 shrink-0 ${
            isSelected ? 'rotate-90 text-church-blue-400' : ''
          }`}
        />
      </button>

      {/* Absolute Overlay DrillPanel: sits right next to the row, overlaying the next column */}
      <AnimatePresence>
        {isSelected && (
          <DrillPanel
            mc={mc}
            selectedBuscentaId={selectedBuscentaId}
            onBuscentaSelect={onBuscentaSelect}
            scrollRef={drillPanelRef}
            theme={theme}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// BUSCENTA ROW — accordion row inside DrillPanel, expands cells vertically
// ==========================================
function BuscentaRow({ buscenta, isSelected, onSelect, theme }) {
  const isCell = buscenta.unit_type === 'CELL';
  const leader = isCell
    ? (buscenta.leaders?.find(l => l.role?.toLowerCase() === 'cell shepherd') || buscenta.leaders?.[0])
    : buscenta.leaders?.[0];
  const children = buscenta.children || [];

  // Sort cells numerically by trailing number in name (e.g. "JB Cell 01" < "JB Cell 02")
  const sortedChildren = [...children].sort((a, b) => {
    const numA = parseInt(a.name?.match(/(\d+)\s*$/)?.[1] || '0', 10);
    const numB = parseInt(b.name?.match(/(\d+)\s*$/)?.[1] || '0', 10);
    return numA - numB;
  });

  const memberCount = isCell
    ? ((buscenta.members?.length || 0) + (buscenta.leaders?.length || 0))
    : countDescendantMembers(buscenta);

  const activeBg = theme?.buscentaActiveBg || 'bg-indigo-950/70 border-indigo-500/40';
  const inactiveBg = theme?.buscentaBg || 'bg-slate-900/60 border-white/[0.06]';
  const accentColor = theme?.textColor || 'text-indigo-400';

  return (
    <div className="w-full">
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-left border transition-all duration-300 ${
          isSelected
            ? `${activeBg} ring-1 ring-white/10`
            : `${inactiveBg} hover:border-white/20`
        }`}
      >
        <Avatar person={leader} size="sm" accent="border-white/10" />
        <div className="min-w-0 flex-1">
          {/* Shepherd / leader name FIRST — bold */}
          <h5 className="text-[10px] font-black text-white leading-tight uppercase tracking-tight truncate">
            {leader?.name || (isCell ? 'No Shepherd' : 'No Leader')}
          </h5>
          {/* Unit name SECOND — smaller lighter font */}
          <p className={`text-[8px] ${accentColor} font-semibold uppercase tracking-wider mt-0.5 truncate opacity-70`}>
            {buscenta.name}
          </p>
          <div className="flex items-center gap-3 mt-1">
            {!isCell && (
              <span className="text-[8px] text-slate-400 flex items-center gap-1 font-bold">
                <Home size={8} className="shrink-0" />
                <span className="font-black text-white">{children.length}</span>
              </span>
            )}
            <span className="text-[8px] text-slate-400 flex items-center gap-1 font-bold">
              <Users size={8} className="shrink-0" />
              <span className="font-black text-white">{memberCount}</span>
            </span>
          </div>
        </div>
        <ChevronRight
          size={10}
          className={`transition-transform duration-300 shrink-0 ${accentColor} ${
            isSelected ? 'rotate-90' : 'opacity-40'
          }`}
        />
      </button>

      {/* Vertical expansion — accordion */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="ml-3 mt-1.5 pb-1 space-y-1.5">
              {isCell ? (() => {
                const people = getCellPeople(buscenta);
                const shepherds = people.filter(p => p.isShepherd);
                const members = people.filter(p => !p.isShepherd);
                return (
                  <>
                    {shepherds.map((p, i) => (
                      <div
                        key={`shep-${i}`}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border ${theme?.shepherdBg || 'bg-slate-900/80 border-white/[0.05]'}`}
                      >
                        <Avatar person={p} size="sm" accent="border-white/[0.08]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-black text-white truncate">{p.name}</p>
                          <p className={`text-[7.5px] ${accentColor} font-semibold uppercase tracking-wider mt-0.5 opacity-70`}>Shepherd</p>
                        </div>
                      </div>
                    ))}
                    {members.map((m, i) => (
                      <div
                        key={`mem-${i}`}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border ${theme?.memberBg || 'bg-slate-900/40 border-white/[0.03]'}`}
                      >
                        <Avatar person={m} size="sm" accent="border-white/[0.08]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold text-slate-300 truncate">{m.name}</p>
                          <p className="text-[7.5px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5 opacity-70">Member</p>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })() : (
                <>
                  <p className="text-[7px] font-black uppercase tracking-widest text-slate-600 px-1 mb-1.5">
                    Cells · {sortedChildren.length}
                  </p>
                  {sortedChildren.length === 0 ? (
                    <p className="text-[9px] text-slate-600 italic text-center py-3">No cells yet</p>
                  ) : (
                    // Each cell is now an expandable CellRow accordion
                    <CellRowList cells={sortedChildren} theme={theme} accentColor={accentColor} />
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// CELL ROW — expandable cell card inside Buscenta accordion, shows shepherd + members
// ==========================================
function CellRow({ cell, theme, accentColor }) {
  const [expanded, setExpanded] = useState(false);
  const shepherd = getPrimaryCellShepherd(cell) || cell.leaders?.[0];
  const people = getCellPeople(cell);
  const shepherds = people.filter(p => p.isShepherd);
  const members = people.filter(p => !p.isShepherd);
  const total = (cell.leaders?.length || 0) + (cell.members?.length || 0);

  return (
    <div className="w-full">
      <button
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex items-center gap-2 p-2.5 rounded-xl border transition-all duration-200 text-left ${
          expanded
            ? `${theme?.cellActiveBg || 'bg-slate-800/60 border-white/20 text-white'} ring-1 ring-white/10`
            : `${theme?.cellBg || 'bg-slate-900/60 border-white/[0.05]'} hover:border-white/15`
        }`}
      >
        <Avatar person={shepherd} size="sm" accent="border-white/[0.08]" />
        <div className="min-w-0 flex-1">
          {/* Shepherd name FIRST — bold */}
          <p className="text-[9px] font-black text-white truncate">
            {shepherd?.name || 'No Shepherd Assigned'}
          </p>
          {/* Cell unit name SECOND — smaller lighter font */}
          <p className={`text-[7.5px] ${accentColor} font-semibold uppercase tracking-wider mt-0.5 truncate opacity-70`}>
            {cell.name}
          </p>
          <p className="text-[7px] text-slate-500 font-medium mt-0.5">
            <span className="text-slate-300 font-black">{total}</span> people
          </p>
        </div>
        <ChevronRight
          size={9}
          className={`transition-transform duration-200 shrink-0 ${accentColor} opacity-60 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="ml-3 mt-1 pb-1 space-y-1">
              {shepherds.length === 0 && members.length === 0 ? (
                <p className="text-[8px] text-slate-600 italic text-center py-2">No members yet</p>
              ) : (
                <>
                  {shepherds.map((p, i) => (
                    <div
                      key={`cshep-${i}`}
                      className={`flex items-center gap-2 p-2 rounded-lg border ${theme?.shepherdBg || 'bg-slate-900/80 border-white/[0.05]'}`}
                    >
                      <Avatar person={p} size="sm" accent="border-white/[0.08]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[8.5px] font-black text-white truncate">{p.name}</p>
                        <p className={`text-[7px] ${accentColor} font-semibold uppercase tracking-wider mt-0.5 opacity-70`}>Shepherd</p>
                      </div>
                    </div>
                  ))}
                  {members.map((m, i) => (
                    <div
                      key={`cmem-${i}`}
                      className={`flex items-center gap-2 p-2 rounded-lg border ${theme?.memberBg || 'bg-slate-900/40 border-white/[0.03]'}`}
                    >
                      <Avatar person={m} size="sm" accent="border-white/[0.08]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[8.5px] font-bold text-slate-300 truncate">{m.name}</p>
                        <p className="text-[7px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5 opacity-70">Member</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Renders a sorted list of expandable CellRow items
function CellRowList({ cells, theme, accentColor }) {
  return (
    <div className="space-y-1.5">
      {cells.map(cell => (
        <CellRow key={cell.id} cell={cell} theme={theme} accentColor={accentColor} />
      ))}
    </div>
  );
}

// ==========================================
// DRILL PANEL — horizontal absolute overlay panel showing buscentas of selected MC
// ==========================================
function DrillPanel({ mc, selectedBuscentaId, onBuscentaSelect, scrollRef, theme }) {
  const buscentas = mc.children || [];
  const panelBgColor = theme?.panelBgColor || "#0b0f19";
  const panelBorderColor = theme?.panelBorderColor || "rgba(255, 255, 255, 0.08)";

  return (
    // pointer-events-none on outer so the panel NEVER blocks clicks on sibling columns
    <motion.div
      ref={scrollRef}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="absolute left-[214px] top-0 w-[240px] shrink-0 flex flex-col border rounded-3xl shadow-2xl z-35 pointer-events-none"
      style={{
        backgroundColor: panelBgColor,
        borderColor: panelBorderColor,
        maxHeight: 445
      }}
    >
      {/* Caret pointing to parent card */}
      <div
        className="absolute -left-[9px] top-5 w-4 h-4 border-l border-b rotate-45 z-10"
        style={{
          backgroundColor: panelBgColor,
          borderColor: panelBorderColor
        }}
      />

      {/* pointer-events-auto on inner content so panel rows remain fully clickable */}
      <div className="flex flex-col flex-1 overflow-hidden rounded-3xl pointer-events-auto">
        {/* Panel header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] shrink-0">
          <h4 className="text-[12px] font-black text-white leading-tight uppercase tracking-tight truncate">
            {mc.name}
          </h4>
          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
            {getUnitChildPlural(mc, buscentas.length)}
          </p>
        </div>

        {/* Buscenta / Cell list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
          {buscentas.length === 0 ? (
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider text-center py-8">
              NO {getChildLabel(mc)} YET
            </p>
          ) : (
            buscentas.map((busc) => (
              <BuscentaRow
                key={busc.id}
                buscenta={busc}
                theme={theme}
                isSelected={selectedBuscentaId === busc.id}
                onSelect={() => onBuscentaSelect(busc.id)}
              />
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}


// ==========================================
// MAIN COMPONENT
// ==========================================
export default function MindMapDrillDown({ searchTerm = "" }) {
  const { getManagedUnits } = useAuth();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeZoneIndex, setActiveZoneIndex] = useState(0);

  // selectedMCId: which MC row is selected (opens DrillPanel horizontally)
  const [selectedMCId, setSelectedMCId] = useState(null);
  // selectedBuscentaId: which Buscenta in the DrillPanel is selected (expands cells vertically)
  const [selectedBuscentaId, setSelectedBuscentaId] = useState(null);

  const drillPanelRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const [managedUnits, data] = await Promise.all([
          getManagedUnits(),
          fetchHierarchyData(),
        ]);
        let filtered = data;
        if (managedUnits !== "ALL") {
          filtered = data.filter((u) => managedUnits.has(u.id));
        }
        const built = buildTree(filtered);
        setTree(built);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getManagedUnits]);

  const activeZone = tree[activeZoneIndex];

  // Reset on zone change
  useEffect(() => {
    setSelectedMCId(null);
    setSelectedBuscentaId(null);
  }, [activeZoneIndex]);

  // Auto-scroll DrillPanel into view
  useEffect(() => {
    if (selectedMCId && drillPanelRef.current) {
      setTimeout(() => {
        drillPanelRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
      }, 250);
    }
  }, [selectedMCId]);

  // Find the selected MC node inside activeZone to render inside DrillPanel
  const selectedMCNode = useMemo(() => {
    if (!selectedMCId || !activeZone?.children) return null;
    for (const col of activeZone.children) {
      if (col.id === selectedMCId) return col;
      const subFound = (col.children || []).find((c) => c.id === selectedMCId);
      if (subFound) return subFound;
    }
    return null;
  }, [selectedMCId, activeZone]);

  // Recursive search helper — matches a node or any of its descendants
  const filterNodeRecursive = useCallback((node, term) => {
    const selfMatches =
      node.name?.toLowerCase().includes(term) ||
      node.leaders?.some((l) => l.name?.toLowerCase().includes(term)) ||
      node.members?.some((m) => m.name?.toLowerCase().includes(term));

    if (node.unit_type === 'CELL') {
      return selfMatches ? node : null;
    }

    const filteredChildren = (node.children || [])
      .map((child) => filterNodeRecursive(child, term))
      .filter(Boolean);

    if (selfMatches || filteredChildren.length > 0) {
      return {
        ...node,
        children: selfMatches ? node.children : filteredChildren,
      };
    }
    return null;
  }, []);

  // Search filtering
  const filteredMCs = useMemo(() => {
    if (!activeZone?.children) return [];
    if (!searchTerm.trim()) return activeZone.children;
    const term = searchTerm.toLowerCase();
    return activeZone.children
      .map((col) => filterNodeRecursive(col, term))
      .filter(Boolean);
  }, [activeZone, searchTerm, filterNodeRecursive]);

  // Check if the selected MC belongs to the last column
  const isLastColActive = useMemo(() => {
    if (!selectedMCId || !filteredMCs.length) return false;
    const lastCol = filteredMCs[filteredMCs.length - 1];
    return lastCol.id === selectedMCId || (lastCol.children || []).some(c => c.id === selectedMCId);
  }, [selectedMCId, filteredMCs]);


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-church-blue-500" />
        <p className="text-slate-400 text-sm font-semibold animate-pulse">
          Loading structure…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm font-semibold max-w-lg mx-auto text-center my-12">
        Failed to load hierarchy: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Zone Selector Tabs */}
      {tree.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 p-1.5 bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-2xl max-w-max mx-auto shadow-inner">
          {tree.map((zone, idx) => (
            <button
              key={zone.id}
              onClick={() => {
                setActiveZoneIndex(idx);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeZoneIndex === idx
                  ? "bg-church-blue-600 text-white shadow-lg shadow-church-blue-500/25 scale-[1.02]"
                  : "bg-transparent text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {zone.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Hierarchy Tree Container ── */}
      <div className="flex flex-col w-full">
        {/* ── Active Zone Head Card ── */}
        {activeZone && (
          <div className="flex flex-col items-center">
            {(() => {
              const zoneHead = activeZone.unit_type === 'CELL'
                ? (activeZone.leaders?.find(l => l.role?.toLowerCase() === 'cell shepherd') || activeZone.leaders?.[0])
                : activeZone.leaders?.[0];
              return (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative group flex items-center gap-5 px-6 py-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-white/10 hover:border-white/20 rounded-3xl shadow-2xl w-full max-w-sm transition-all duration-300"
                >
                  <div className="relative">
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-church-blue-600 to-violet-600 opacity-20 blur-sm group-hover:opacity-40 transition duration-350" />
                    <Avatar
                      person={zoneHead}
                      size="xl"
                      accent="border-church-blue-500/40"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white leading-tight uppercase tracking-tight">
                      {zoneHead?.name || "Unassigned"}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                      {activeZone.unit_type === 'CELL'
                        ? (zoneHead?.role?.toLowerCase() === 'cell shepherd' ? 'Cell Shepherd' : (zoneHead?.role || getRoleLabel(activeZone.unit_type)))
                        : (zoneHead?.role || getRoleLabel(activeZone.unit_type))}
                    </p>
                  </div>
                </motion.div>
              );
            })()}

            {filteredMCs.length > 0 && (
              <div className="w-0.5 h-6 bg-slate-700/60 mt-1" />
            )}

            {/* ── CELL-level zone view ── */}
            {activeZone.unit_type === "CELL" && (() => {
              const cellPeople = getCellPeople(activeZone);
              const shepherds = cellPeople.filter(p => p.isShepherd);
              const members = cellPeople.filter(p => !p.isShepherd);
              const totalCount = shepherds.length + members.length;

              return (
                <div className="w-full max-w-sm space-y-3 mt-3">
                  {totalCount === 0 ? (
                    <p className="text-[9px] text-slate-600 italic text-center py-4">
                      No shepherds or members in this cell yet
                    </p>
                  ) : (
                    <>
                      {shepherds.length > 0 && (
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-violet-400/70 mb-1.5 px-1">
                            Shepherds
                          </p>
                          <div className="space-y-1.5">
                            {shepherds.map((p, i) => (
                              <div
                                key={`shep-${i}`}
                                className="flex items-center gap-3 bg-violet-950/10 border border-violet-500/20 rounded-2xl p-3"
                              >
                                <Avatar person={p} size="sm" accent="border-violet-500/30" />
                                <span className="text-[11px] text-violet-300 font-bold truncate">
                                  {p.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {members.length > 0 && (
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-500/70 mb-1.5 px-1">
                            Members
                          </p>
                          <div className="space-y-1.5">
                            {members.map((m, i) => (
                              <div
                                key={`mem-${i}`}
                                className="flex items-center gap-3 bg-slate-900/50 rounded-2xl p-3 border border-white/5"
                              >
                                <Avatar person={m} size="sm" accent="border-white/10" />
                                <span className="text-[11px] text-slate-300 font-bold truncate">
                                  {m.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Columns ── */}
        {filteredMCs.length > 0 && (
          <div
            ref={scrollContainerRef}
            className="w-full overflow-x-auto -mx-2 px-2 no-scrollbar"
          >
            <div
              className="flex gap-0 w-max mx-auto relative pb-[100px]"
            >
              {filteredMCs.map((mc, idx) => {
                const theme = MC_THEMES[idx % MC_THEMES.length];
                const mcLeader = mc.unit_type === 'CELL'
                  ? mc.leaders?.find(l => l.role?.toLowerCase() === 'cell shepherd') || null
                  : mc.leaders?.[0];

                const childCount = mc.unit_type === "CELL"
                  ? (mc.members?.length || 0) + (mc.leaders?.length || 0)
                  : (mc.children?.length || 0);

                const isSelectedCol = mc.id === selectedMCId || (mc.children || []).some(c => c.id === selectedMCId);

                return (
                  <div
                    key={mc.id}
                    className="flex items-start shrink-0"
                    style={{ zIndex: isSelectedCol ? 40 : 0, position: 'relative' }}
                  >
                    {/* Main Column */}
                    <div
                      className="flex flex-col items-center shrink-0"
                      style={{ width: 220, scrollSnapAlign: "center" }}
                    >
                      {/* Connector lines */}
                      <div className="w-full flex flex-col items-center">
                        <div className="w-full h-0.5 relative">
                          {idx > 0 && <div className="absolute right-1/2 top-0 h-0.5 bg-slate-700/60" style={{ width: '50%' }} />}
                          {idx < filteredMCs.length - 1 && <div className="absolute left-1/2 top-0 h-0.5 bg-slate-700/60" style={{ width: '50%' }} />}
                        </div>
                        <div className="w-0.5 h-5 bg-slate-700/60" />
                      </div>

                      {/* MC Photo Card */}
                      <div className="w-full px-1.5 shrink-0 relative z-10 group cursor-pointer">
                        <div className="w-full rounded-2xl overflow-hidden border border-white/5 shadow-xl bg-slate-950/80 hover:scale-[1.01] transition-all duration-300">
                          {/* Photo */}
                          <div className="w-full h-40 bg-slate-950 overflow-hidden relative">
                            {mcLeader?.photo ? (
                              <>
                                <img src={mcLeader.photo} alt={mcLeader.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" style={{ objectPosition: "center 20%" }} />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 pointer-events-none" />
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-6xl font-black text-slate-700">{mcLeader?.name?.charAt(0).toUpperCase() || "?"}</span>
                              </div>
                            )}
                          </div>
                          {/* Name plate */}
                          <div className={`px-3 py-2.5 ${theme.namePlateBg}`}>
                            <span className={`inline-block mb-1 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider bg-white/5 border border-white/10 rounded ${theme.textColor}`}>
                              {mc.unit_type === 'CELL' ? 'CELL SHEPHERD' : (mcLeader?.role?.toUpperCase() || getRoleLabel(mc.unit_type))}
                            </span>
                            <h4 className="text-[11px] font-black text-white leading-tight uppercase tracking-tight truncate">
                              {mcLeader?.name || "No Leader Assigned"}
                            </h4>
                            <p className={`text-[8px] ${theme.textColor} font-bold uppercase tracking-wider mt-0.5 truncate`}>
                              {mc.name}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Column Lane Container */}
                      <div
                        className={`w-full flex flex-col pb-6 min-h-[500px] relative border-r border-slate-800/40 last:border-r-0 z-0`}
                        style={{ marginTop: '-165px' }}
                      >
                        <div className="absolute inset-0 flex flex-col pointer-events-none -z-10">
                          <div className={`w-full h-[165px] ${theme.darkTint}`} />
                          <div className={`w-full flex-1 ${theme.lightTint}`} />
                        </div>
                        <div className="w-full shrink-0 pointer-events-none" style={{ height: 165 }} />
                        
                        {/* Content Area */}
                        <div className="w-full flex flex-col px-2.5 gap-3 mt-1">
                          {mc.unit_type !== 'CELL' && (
                            <div className="flex items-center justify-between px-1 mb-0.5">
                              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                                {getChildLabel(mc)}
                              </span>
                              <span className="text-[8px] font-black text-slate-500 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded-full">
                                {childCount}
                              </span>
                            </div>
                          )}

                          {childCount === 0 && (
                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider text-center py-4">
                              {mc.unit_type === 'CELL'
                                ? 'NO SHEPHERDS OR MEMBERS IN THIS CELL YET'
                                : `NO ${getChildLabel(mc)} YET`}
                            </p>
                          )}

                          {/* MC rows inside the column */}
                          {mc.unit_type !== 'CELL' &&
                            (mc.children || []).map((subItem) => (
                              <MCItem
                                key={subItem.id}
                                mc={subItem}
                                theme={theme}
                                isSelected={selectedMCId === subItem.id}
                                onSelect={() => {
                                  setSelectedMCId(prev => prev === subItem.id ? null : subItem.id);
                                  setSelectedBuscentaId(null);
                                }}
                                selectedBuscentaId={selectedBuscentaId}
                                onBuscentaSelect={(buscId) => setSelectedBuscentaId(prev => prev === buscId ? null : buscId)}
                                drillPanelRef={drillPanelRef}
                              />
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Spacer to allow scrolling to absolute overlays on the rightmost column */}
              {isLastColActive && <div className="w-[240px] shrink-0 pointer-events-none" />}
            </div>
          </div>
        )}
      </div>

      {/* Empty search state */}
      {searchTerm && filteredMCs.length === 0 && (
        <div className="text-center py-16 opacity-50">
          <p className="text-slate-400 text-sm font-semibold">
            No results for "<span className="text-white">{searchTerm}</span>"
          </p>
        </div>
      )}
    </div>
  );
}
