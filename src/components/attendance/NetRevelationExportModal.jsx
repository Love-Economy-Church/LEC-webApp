import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';
import { Calendar, Share2, Download, Check, X, Loader2, Globe, FileText, AlertOctagon } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function NetRevelationExportModal({
  isOpen,
  onClose,
  selectedSessionKey,
  currentRole,
  overrideUnitId = null,
  overrideUnitType = null,
  overrideUnitName = null
}) {
  const [loading, setLoading] = useState(false);
  const [dbData, setDbData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Resolve date and service name from selectedSessionKey with safe fallback
  const { date, serviceName, formattedDate } = useMemo(() => {
    try {
      if (!selectedSessionKey) return { date: '', serviceName: '', formattedDate: '' };
      const [datePart, ...serviceParts] = selectedSessionKey.split('_');
      const sName = serviceParts.join('_');
      const fDate = new Date(datePart).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      return { date: datePart, serviceName: sName, formattedDate: fDate };
    } catch (err) {
      console.error('Error resolving session key:', err);
      return { date: '', serviceName: '', formattedDate: '' };
    }
  }, [selectedSessionKey]);

  // 2. Resolve active unit scope
  const activeScopeId = overrideUnitId || currentRole?.unitId;
  const activeScopeType = overrideUnitType || currentRole?.unitType;
  const activeScopeName = overrideUnitName || currentRole?.unitName || 'Church Unit';

  // 3. Load database data for calculations when modal opens
  useEffect(() => {
    if (!isOpen || !activeScopeId || !date || !serviceName) return;

    async function fetchData() {
      setLoading(true);
      setErrorMsg('');
      try {
        // Fetch all active units to construct descendants
        const { data: units, error: unitsError } = await supabase
          .from('organizational_units')
          .select('id, name, unit_type, parent_id')
          .eq('is_active', true);

        if (unitsError) throw unitsError;

        // Fetch all sessions and records for the selected date and service name
        const { data: sessions, error: sessionsError } = await supabase
          .from('attendance_sessions')
          .select(`
            id,
            unit_id,
            service_name,
            session_date,
            attendance_records (
              person_id,
              status,
              person:people (
                full_name,
                assignments:position_assignments (
                  is_active,
                  position:positions ( title )
                )
              )
            )
          `)
          .eq('session_date', date)
          .eq('service_name', serviceName);

        if (sessionsError) throw sessionsError;

        setDbData({ units, sessions });
      } catch (err) {
        console.error('Error fetching Net Revelation report data:', err);
        setErrorMsg(err.message || 'Failed to load records from database');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isOpen, activeScopeId, date, serviceName]);

  // 4. Compute all Net Revelation values dynamically
  const reportData = useMemo(() => {
    try {
      if (!dbData || !activeScopeId) return null;
      const { units, sessions } = dbData;

      // Helper: Traverse hierarchy to find all children recursively
      const getDescendants = (rootId) => {
        const descendants = [];
        const traverse = (id) => {
          const children = units.filter(u => u.parent_id === id);
          children.forEach(c => {
            descendants.push(c);
            traverse(c.id);
          });
        };
        traverse(rootId);
        return descendants;
      };

      const descendants = getDescendants(activeScopeId);
      const scopeUnit = units.find(u => u.id === activeScopeId);
      
      // Total cells under current scope
      let scopedCells = [];
      let scopedBuscentas = [];

      if (activeScopeType === 'CELL') {
        scopedCells = scopeUnit ? [scopeUnit] : [];
      } else {
        scopedCells = descendants.filter(d => d.unit_type === 'CELL');
        scopedBuscentas = descendants.filter(d => d.unit_type === 'BUSCENTA');
      }

      // If activeScopeType is BUSCENTA, the active unit itself is the buscenta
      if (activeScopeType === 'BUSCENTA' && scopeUnit) {
        scopedBuscentas = [scopeUnit];
      }

      // Compile active unit lists
      const cellIdsSet = new Set(scopedCells.map(c => c.id));
      const buscentaIdsSet = new Set(scopedBuscentas.map(b => b.id));

      // Calculate Cell Attendances (Physical & Online)
      let physicalCellAttendance = 0;
      let onlineCellAttendance = 0;

      // Build buscenter maps to group cells
      const buscenterMap = {};
      scopedBuscentas.forEach(b => {
        buscenterMap[b.id] = {
          name: b.name || 'Unknown Buscenter',
          cells: []
        };
      });

      // Handle orphaned cells or when scope is CELL
      const unassignedBuscenterKey = 'unassigned';
      buscenterMap[unassignedBuscenterKey] = {
        name: 'OTHER CELLS',
        cells: []
      };

      // Keep track of each cell's attendance count for category analysis
      const cellAttendanceCounts = [];

      scopedCells.forEach(cell => {
        // Find session for this cell
        const session = sessions.find(s => s.unit_id === cell.id);
        let cellPresent = 0;
        let cellOnline = 0;

        if (session && session.attendance_records) {
          session.attendance_records.forEach(rec => {
            if (rec.status === 'PRESENT') {
              cellPresent++;
            } else if (rec.status === 'ONLINE') {
              cellOnline++;
            }
          });
        }

        physicalCellAttendance += cellPresent;
        onlineCellAttendance += cellOnline;
        
        const totalCellCount = cellPresent + cellOnline;
        cellAttendanceCounts.push(totalCellCount);

        // Clean cell display name (remove buscenter prefix if it exists to keep formatting clean)
        let cleanCellName = cell.name || 'Cell';
        cleanCellName = cleanCellName.replace(/^[A-Z0-9\s]+Cell/i, 'Cell');
        cleanCellName = cleanCellName.replace(/^Cell\s+0+(\d+)/i, 'Cell $1');

        const cellInfo = {
          name: cleanCellName,
          present: cellPresent,
          online: cellOnline,
          total: totalCellCount
        };

        const parentB = buscenterMap[cell.parent_id];
        if (parentB) {
          parentB.cells.push(cellInfo);
        } else {
          buscenterMap[unassignedBuscenterKey].cells.push(cellInfo);
        }
      });

      // Clean up empty buscenter groups
      const formattedBuscenters = Object.values(buscenterMap).filter(b => b.cells.length > 0);

      // Calculate Leader Attendance (MC Head, Buscenta Heads, Church Head, Branch Pastor)
      let mcHeadsPresent = 0;
      let buscentaHeadsPresent = 0;
      let churchHeadsPresent = 0;
      let branchPastorsPresent = 0;

      sessions.forEach(session => {
        if (session.attendance_records) {
          session.attendance_records.forEach(rec => {
            if (rec.status === 'PRESENT') {
              const isMcHead = rec.person?.assignments?.some(a => a.is_active && a.position?.title === 'MC Head');
              const isBuscentaHead = rec.person?.assignments?.some(a => a.is_active && a.position?.title === 'Buscenta Head');
              const isChurchHead = rec.person?.assignments?.some(a => a.is_active && a.position?.title === 'Church Head');
              const isBranchPastor = rec.person?.assignments?.some(a => a.is_active && a.position?.title === 'Alpha Branch Pastor');

              if (isMcHead && session.unit_id === activeScopeId) {
                mcHeadsPresent++;
              }
              if (isBuscentaHead && buscentaIdsSet.has(session.unit_id)) {
                buscentaHeadsPresent++;
              }
              if (isChurchHead && session.unit_id === activeScopeId) {
                churchHeadsPresent++;
              }
              if (isBranchPastor && session.unit_id === activeScopeId) {
                branchPastorsPresent++;
              }
            }
          });
        }
      });

      // Default Fallbacks if sessions weren't marked for leadership units
      let finalMcHeadCount = mcHeadsPresent;
      let finalBuscentaHeadCount = buscentaHeadsPresent;
      let finalChurchHeadCount = churchHeadsPresent;
      let finalBranchPastorCount = branchPastorsPresent;

      if (activeScopeType === 'MC' && finalMcHeadCount === 0) finalMcHeadCount = 1;
      if (['CHURCH', 'BRANCH'].includes(activeScopeType) && finalMcHeadCount === 0) finalMcHeadCount = scopedBuscentas.length > 0 ? Math.round(scopedBuscentas.length / 3) : 1;
      if (scopedBuscentas.length > 0 && finalBuscentaHeadCount === 0) finalBuscentaHeadCount = scopedBuscentas.length;
      if (['CHURCH', 'BRANCH'].includes(activeScopeType) && finalChurchHeadCount === 0) finalChurchHeadCount = 1;
      if (activeScopeType === 'BRANCH' && finalBranchPastorCount === 0) finalBranchPastorCount = 1;

      // Expected target and leaders present based on scope level
      let target = 0;
      let leadersCountText = '';
      let leadersCountVal = 0;
      let physicalTotal = 0;

      if (activeScopeType === 'CELL') {
        target = 13;
        leadersCountVal = 0;
        physicalTotal = physicalCellAttendance;
      } else if (activeScopeType === 'BUSCENTA') {
        target = (scopedCells.length * 13) + finalBuscentaHeadCount;
        leadersCountText = `*SENIOR SHEPHERDS* - ${finalBuscentaHeadCount}`;
        leadersCountVal = finalBuscentaHeadCount;
        physicalTotal = physicalCellAttendance + finalBuscentaHeadCount;
      } else if (activeScopeType === 'MC') {
        target = (scopedCells.length * 13) + finalMcHeadCount + finalBuscentaHeadCount;
        leadersCountText = `*SENIOR SHEPHERDS* - ${finalBuscentaHeadCount}\n*MC HEAD* - ${finalMcHeadCount}`;
        leadersCountVal = finalBuscentaHeadCount + finalMcHeadCount;
        physicalTotal = physicalCellAttendance + finalBuscentaHeadCount + finalMcHeadCount;
      } else if (activeScopeType === 'CHURCH') {
        target = (scopedCells.length * 13) + finalChurchHeadCount + finalMcHeadCount + finalBuscentaHeadCount;
        leadersCountText = `*SENIOR SHEPHERDS* - ${finalBuscentaHeadCount}\n*MC HEADS* - ${finalMcHeadCount}\n*CHURCH HEAD* - ${finalChurchHeadCount}`;
        leadersCountVal = finalBuscentaHeadCount + finalMcHeadCount + finalChurchHeadCount;
        physicalTotal = physicalCellAttendance + finalBuscentaHeadCount + finalMcHeadCount + finalChurchHeadCount;
      } else if (activeScopeType === 'BRANCH') {
        target = (scopedCells.length * 13) + finalBranchPastorCount + finalChurchHeadCount + finalMcHeadCount + finalBuscentaHeadCount;
        leadersCountText = `*SENIOR SHEPHERDS* - ${finalBuscentaHeadCount}\n*MC HEADS* - ${finalMcHeadCount}\n*CHURCH HEADS* - ${finalChurchHeadCount}\n*ALPHA BRANCH PASTOR* - ${finalBranchPastorCount}`;
        leadersCountVal = finalBuscentaHeadCount + finalMcHeadCount + finalChurchHeadCount + finalBranchPastorCount;
        physicalTotal = physicalCellAttendance + finalBuscentaHeadCount + finalMcHeadCount + finalChurchHeadCount + finalBranchPastorCount;
      }

      const totalGathered = physicalTotal + onlineCellAttendance;
      const difference = target - totalGathered;

      // Categorize cells for Net Revelation Analysis
      const analysis = {
        '13+': 0,
        '10-12': 0,
        '6-9': 0,
        '3-5': 0,
        '0-2': 0
      };

      cellAttendanceCounts.forEach(count => {
        if (count >= 13) analysis['13+']++;
        else if (count >= 10) analysis['10-12']++;
        else if (count >= 6) analysis['6-9']++;
        else if (count >= 3) analysis['3-5']++;
        else analysis['0-2']++;
      });

      // 5. Generate WhatsApp text
      const cleanDateText = date ? date.split('-').reverse().join('/') : '';
      const cleanServiceText = serviceName ? serviceName.toUpperCase() : '';
      let waText = `*${activeScopeName} (${cleanServiceText})*\n${cleanDateText}\n\n`;
      
      formattedBuscenters.forEach(bc => {
        const cleanBcName = bc.name ? bc.name.toUpperCase() : 'BUSCENTER';
        waText += `*${cleanBcName}*\n`;
        bc.cells.forEach(c => {
          waText += `${c.name || 'Cell'} - ${c.present}\n`;
        });
        waText += '\n';
      });

      waText += `Total cell attendance - ${physicalCellAttendance + onlineCellAttendance}\n`;
      if (leadersCountText) waText += `${leadersCountText}\n`;
      waText += `\n*TOTAL* = ${physicalTotal}\n`;
      waText += `Online: ${onlineCellAttendance}\n\n`;
      waText += `*NET REVELATION ATTENDANCE* - ${target}\n\n`;
      waText += `*DIFFERENCE* - ${difference}\n\n`;
      waText += `*NET REVELATION ANALYSIS*\n`;
      waText += `13+ = ${analysis['13+']}\n`;
      waText += `10-12 = ${analysis['10-12']}\n`;
      waText += `6-9 = ${analysis['6-9']}\n`;
      waText += `3-5 = ${analysis['3-5']}\n`;
      waText += `0-2 = ${analysis['0-2']}`;

      return {
         WaText: waText,
         Buscenters: formattedBuscenters,
         CellCount: scopedCells.length,
         PhysicalCellTotal: physicalCellAttendance,
         OnlineCellTotal: onlineCellAttendance,
         PhysicalTotal: physicalTotal,
         Target: target,
         Difference: difference,
         Analysis: analysis,
         LeadersCountVal: leadersCountVal,
         LeadersDetails: leadersCountText.replace(/\*/g, '')
      };
    } catch (err) {
      console.error('Error in Net Revelation report calculations useMemo:', err);
      return { error: err.message || 'Error processing records' };
    }
  }, [dbData, activeScopeId, activeScopeType, activeScopeName, date, serviceName]);

  // 6. Share to WhatsApp Handler
  const handleShareWhatsApp = () => {
    if (!reportData || reportData.error) return;
    const url = `https://wa.me/?text=${encodeURIComponent(reportData.WaText)}`;
    window.open(url, '_blank');
  };

  // 7. PDF Download Handler
  const handleDownloadPDF = () => {
    if (!reportData || reportData.error) return;
    const r = reportData;

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      
      const slatePrimary = [15, 23, 42];
      const blueAccent = [79, 70, 229];
      const grayText = [100, 116, 139];
      const goldAccent = [217, 119, 6];

      // Header Banner
      doc.setFillColor(...slatePrimary);
      doc.rect(0, 0, 210, 48, 'F');
      
      doc.setFillColor(...goldAccent);
      doc.rect(0, 48, 210, 2, 'F');

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text("NET REVELATION ATTENDANCE REPORT", 14, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(191, 196, 210);
      doc.text(`${activeScopeName.toUpperCase()}`, 14, 26);
      doc.text(`Service: ${serviceName}  |  Date: ${formattedDate}`, 14, 32);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(253, 186, 116);
      doc.text(`Target: ${r.Target}`, 155, 22, { align: 'right' });
      doc.text(`Gathered: ${r.PhysicalTotal + r.OnlineCellTotal}`, 155, 29, { align: 'right' });
      
      const diffColor = r.Difference <= 0 ? [74, 222, 128] : [248, 113, 113];
      doc.setTextColor(...diffColor);
      doc.text(`Diff: ${r.Difference}`, 155, 36, { align: 'right' });

      let currentY = 62;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...slatePrimary);
      doc.text("BUSCENTER & CELL BREAKDOWN", 14, currentY);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(14, currentY + 2, 110, currentY + 2);
      
      currentY += 8;
      
      r.Buscenters.forEach(bc => {
        if (currentY > 260) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...blueAccent);
        doc.text((bc.name || 'Buscenter').toUpperCase(), 14, currentY);
        
        currentY += 5;
        
        bc.cells.forEach(c => {
          if (currentY > 270) {
            doc.addPage();
            currentY = 20;
          }
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(51, 65, 85);
          doc.text(c.name || 'Cell', 18, currentY);
          
          doc.setFont('helvetica', 'bold');
          doc.text(c.present.toString(), 95, currentY, { align: 'right' });
          
          currentY += 4.5;
        });
        
        currentY += 3;
      });

      let rightY = 62;
      const rightColX = 120;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...slatePrimary);
      doc.text("SUMMARY METRICS", rightColX, rightY);
      doc.line(rightColX, rightY + 2, 196, rightY + 2);
      
      rightY += 8;
      
      const kpiMetrics = [
        { label: "Cell Attendance Total", val: r.PhysicalCellTotal + r.OnlineCellTotal },
        { label: "Physical Present (TOTAL)", val: r.PhysicalTotal },
        { label: "Online Attendance", val: r.OnlineCellTotal },
        { label: "Leaders Present", val: r.LeadersCountVal },
        { label: "Net Revelation Target", val: r.Target },
        { label: "Difference (Shortfall)", val: r.Difference }
      ];

      kpiMetrics.forEach((kpi) => {
        doc.setFillColor(248, 250, 252);
        doc.rect(rightColX, rightY, 76, 12, 'F');
        doc.setDrawColor(241, 245, 249);
        doc.rect(rightColX, rightY, 76, 12, 'S');
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...grayText);
        doc.text(kpi.label, rightColX + 3, rightY + 5);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...slatePrimary);
        if (kpi.label.includes("Difference")) {
          const valColor = kpi.val <= 0 ? [22, 163, 74] : [220, 38, 38];
          doc.setTextColor(...valColor);
        }
        doc.text(kpi.val.toString(), rightColX + 73, rightY + 8.5, { align: 'right' });
        
        rightY += 14;
      });

      rightY += 4;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...slatePrimary);
      doc.text("NET REVELATION ANALYSIS", rightColX, rightY);
      doc.line(rightColX, rightY + 2, 196, rightY + 2);
      
      rightY += 8;

      const analysisCategories = [
        { label: "13+ (Full Cells)", val: r.Analysis['13+'], color: [22, 163, 74] },
        { label: "10-12", val: r.Analysis['10-12'], color: [79, 70, 229] },
        { label: "6-9", val: r.Analysis['6-9'], color: [217, 119, 6] },
        { label: "3-5", val: r.Analysis['3-5'], color: [239, 68, 68] },
        { label: "0-2", val: r.Analysis['0-2'], color: [100, 116, 139] }
      ];

      analysisCategories.forEach(cat => {
        doc.setFillColor(...cat.color);
        doc.rect(rightColX, rightY, 2, 8, 'F');
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        doc.text(cat.label, rightColX + 4, rightY + 6.5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(cat.val.toString(), rightColX + 73, rightY + 6.5, { align: 'right' });
        
        rightY += 10;
      });

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...grayText);
      doc.text("Generated by LEC - Alpha Hierarchical Leadership & Attendance System", 105, 285, { align: 'center' });

      const filename = `Net_Revelation_${activeScopeName.replace(/\s+/g, '_')}_${date}.pdf`;
      doc.save(filename);
    } catch (pdfErr) {
      console.error('Error generating PDF:', pdfErr);
      alert('Failed to generate PDF document: ' + pdfErr.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Net Revelation Report"
      maxWidth="max-w-xl"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="animate-spin text-purple-500" size={40} />
          <p className="text-sm font-semibold text-slate-400">Fetching and compiling attendance records...</p>
        </div>
      ) : errorMsg ? (
        <div className="flex flex-col items-center justify-center py-12 text-rose-400 text-center space-y-3">
          <AlertOctagon size={44} className="text-rose-500" />
          <p className="font-bold text-slate-200">Database Fetch Failed</p>
          <p className="text-xs max-w-sm leading-relaxed">{errorMsg}</p>
          <p className="text-[10px] text-slate-500 font-semibold uppercase mt-2">
            Tip: Verify that you applied the database SQL migration scripts.
          </p>
        </div>
      ) : !reportData ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center space-y-2">
          <Globe size={40} className="opacity-40" />
          <p className="font-bold text-slate-200">No session data found</p>
          <p className="text-xs">Ensure attendance has been submitted for this session first.</p>
        </div>
      ) : reportData.error ? (
        <div className="flex flex-col items-center justify-center py-12 text-amber-400 text-center space-y-3">
          <AlertOctagon size={44} className="text-amber-500" />
          <p className="font-bold text-slate-200">Calculation Error</p>
          <p className="text-xs max-w-sm leading-relaxed">{reportData.error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Calendar Header info */}
          <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Calendar size={20} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Scope & Session</p>
                <h4 className="text-sm font-black text-slate-200 mt-0.5">{activeScopeName}</h4>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] bg-slate-800/80 border border-slate-700/50 text-indigo-400 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                {serviceName}
              </span>
              <p className="text-[10px] text-slate-500 font-bold mt-1.5">{formattedDate}</p>
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Target Expected</span>
              <span className="text-2xl font-black text-indigo-400 mt-1 block">{reportData.Target}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Total Gathered</span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">{reportData.PhysicalTotal + reportData.OnlineCellTotal}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">Difference</span>
              <span className={`text-2xl font-black mt-1 block ${reportData.Difference <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {reportData.Difference}
              </span>
            </div>
          </div>

          {/* Text Preview block */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">Share Text Preview</label>
            <div className="relative">
              <pre className="w-full bg-slate-950 border-2 border-slate-800/80 rounded-2xl p-4 text-xs font-mono text-slate-300 overflow-x-auto overflow-y-auto max-h-48 custom-scrollbar whitespace-pre-wrap select-all leading-relaxed">
                {reportData.WaText}
              </pre>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/50">
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba56] text-white py-3.5 px-6 rounded-xl font-black text-sm transition-colors shadow-lg shadow-emerald-500/10 border border-emerald-600/30"
            >
              <Share2 size={18} />
              Share to WhatsApp
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-6 rounded-xl font-black text-sm transition-colors shadow-lg shadow-indigo-500/10 border border-indigo-700/30"
            >
              <Download size={18} />
              Download PDF
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
