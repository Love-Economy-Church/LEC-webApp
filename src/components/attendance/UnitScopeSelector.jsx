import { useState, useEffect } from 'react';
import { fetchHierarchyData } from '../../services/hierarchyService';
import { ChevronRight, LayoutGrid, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function UnitScopeSelector({ userRole, onScopeChange }) {
    const { getManagedUnits } = useAuth();
    const [units, setUnits] = useState([]);
    const [managedUnits, setManagedUnits] = useState(new Set());
    const [loading, setLoading] = useState(true);

    // Selected states
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedChurch, setSelectedChurch] = useState('');
    const [selectedMC, setSelectedMC] = useState('');
    const [selectedBuscenta, setSelectedBuscenta] = useState('');
    const [selectedCell, setSelectedCell] = useState('');

    useEffect(() => {
        if (!userRole) return;
        
        // If CELL leader, no selector needed. Auto-fire scope and exit.
        if (userRole.unitType === 'CELL') {
            onScopeChange(userRole.unitId, 'CELL', userRole.unitName);
            setLoading(false);
            return;
        }

        // If BUSCENTA leader, auto-set their buscenta and show only Cell selector below.
        if (userRole.unitType === 'BUSCENTA') {
            setSelectedBuscenta(userRole.unitId);
        }

        async function loadData() {
            try {
                const [allUnits, managedSet] = await Promise.all([
                    fetchHierarchyData(),
                    getManagedUnits()
                ]);
                
                const allowedUnits = managedSet === 'ALL' 
                    ? allUnits 
                    : allUnits.filter(u => managedSet.has(u.id));

                setUnits(allowedUnits);
                setManagedUnits(managedSet);

                // Initialize starting scope based on user role
                const myUnit = allowedUnits.find(u => u.id === userRole.unitId);
                
                if (myUnit) {
                    // Climb up parents to pre-populate selectors
                    let current = myUnit;
                    while (current) {
                        if (current.unit_type === 'BRANCH') setSelectedBranch(current.id);
                        else if (current.unit_type === 'CHURCH') setSelectedChurch(current.id);
                        else if (current.unit_type === 'MC') setSelectedMC(current.id);
                        else if (current.unit_type === 'BUSCENTA') setSelectedBuscenta(current.id);
                        else if (current.unit_type === 'CELL') setSelectedCell(current.id);
                        
                        current = current.parent_id ? allowedUnits.find(u => u.id === current.parent_id) : null;
                    }
                    
                    // Dispatch initial scope
                    onScopeChange(myUnit.id, myUnit.unit_type, myUnit.name);
                }
            } catch (error) {
                console.error("Failed to load unit scope data:", error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [userRole, getManagedUnits]);

    // Handle emitting the lowest selected scope to parent
    useEffect(() => {
        if (loading || units.length === 0) return;

        let activeId = userRole.unitId;
        let activeType = userRole.unitType;
        let activeName = userRole.unitName;

        if (selectedCell) {
            activeId = selectedCell;
            activeType = 'CELL';
        } else if (selectedBuscenta) {
            activeId = selectedBuscenta;
            activeType = 'BUSCENTA';
        } else if (selectedMC) {
            activeId = selectedMC;
            activeType = 'MC';
        } else if (selectedChurch) {
            activeId = selectedChurch;
            activeType = 'CHURCH';
        } else if (selectedBranch) {
            activeId = selectedBranch;
            activeType = 'BRANCH';
        }

        const unitObj = units.find(u => u.id === activeId);
        
        if (unitObj) {
            onScopeChange(activeId, activeType, unitObj.name);
        } else {
            onScopeChange(activeId, activeType, activeName);
        }

    }, [selectedBranch, selectedChurch, selectedMC, selectedBuscenta, selectedCell, units, loading]);

    if (userRole?.unitType === 'CELL') return null; // Hide completely for cell leaders
    if (loading) return <div className="h-14 animate-pulse bg-slate-800/50 rounded-xl border border-slate-700"></div>;

    // BUSCENTA heads: show only Buscenta + Cell selectors (no Branch/Church/MC chain)
    const isBuscentaLeader = userRole?.unitType === 'BUSCENTA';

    // Derived dropdown options sorted naturally/chronologically (e.g. Branch 1 -> Branch 2 -> Branch 10)
    const sortByName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

    const targetBranches = units.filter(u => u.unit_type === 'BRANCH').sort(sortByName);
    const targetChurches = units.filter(u => u.unit_type === 'CHURCH' && u.parent_id === selectedBranch).sort(sortByName);
    const targetMCs = units.filter(u => u.unit_type === 'MC' && u.parent_id === selectedChurch).sort(sortByName);
    // For BUSCENTA users: show their own + sibling buscentas (all under same parent MC), or filter by selectedMC
    const targetBuscentas = userRole?.unitType === 'BUSCENTA'
        ? units.filter(u => u.unit_type === 'BUSCENTA').sort(sortByName)
        : units.filter(u => u.unit_type === 'BUSCENTA' && u.parent_id === selectedMC).sort(sortByName);
    const targetCells = units.filter(u => u.unit_type === 'CELL' && u.parent_id === selectedBuscenta).sort(sortByName);

    return (
        <div className="space-y-3 mb-6">
            <h3 className="text-lg font-black text-slate-200">SCOPE</h3>

            <div className="space-y-3">
                {/* BRANCH — hidden for BUSCENTA leaders */}
                {!isBuscentaLeader && (targetBranches.length > 0 || selectedBranch) && (
                    <div className="relative">
                        <LayoutGrid size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-church-blue-400 pointer-events-none" />
                        <select
                            value={selectedBranch}
                            onChange={(e) => {
                                setSelectedBranch(e.target.value);
                                setSelectedChurch('');
                                setSelectedMC('');
                                setSelectedBuscenta('');
                                setSelectedCell('');
                            }}
                            disabled={targetBranches.length <= 1}
                            className="w-full bg-[#0b1120] border border-slate-600/60 rounded-2xl pl-12 pr-10 py-4 text-sm font-bold text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-church-blue-500/50 focus:border-church-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <option value="">-- ALL BRANCHES --</option>
                            {targetBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
                    </div>
                )}

                {/* CHURCH — hidden for BUSCENTA leaders */}
                {!isBuscentaLeader && (targetChurches.length > 0 || selectedChurch) && selectedBranch && (
                    <div className="relative">
                        <LayoutGrid size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-church-blue-400 pointer-events-none" />
                        <select
                            value={selectedChurch}
                            onChange={(e) => {
                                setSelectedChurch(e.target.value);
                                setSelectedMC('');
                                setSelectedBuscenta('');
                                setSelectedCell('');
                            }}
                            className="w-full bg-[#0b1120] border border-slate-600/60 rounded-2xl pl-12 pr-10 py-4 text-sm font-bold text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-church-blue-500/50 focus:border-church-blue-500/50 transition-colors"
                        >
                            <option value="">-- ALL CHURCHES --</option>
                            {targetChurches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
                    </div>
                )}

                {/* MC — hidden for BUSCENTA leaders */}
                {!isBuscentaLeader && (targetMCs.length > 0 || selectedMC) && selectedChurch && (
                    <div className="relative">
                        <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-church-blue-400 pointer-events-none" />
                        <select
                            value={selectedMC}
                            onChange={(e) => {
                                setSelectedMC(e.target.value);
                                setSelectedBuscenta('');
                                setSelectedCell('');
                            }}
                            className="w-full bg-[#0b1120] border border-slate-600/60 rounded-2xl pl-12 pr-10 py-4 text-sm font-bold text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-church-blue-500/50 focus:border-church-blue-500/50 transition-colors"
                        >
                            <option value="">-- ALL MCS --</option>
                            {targetMCs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
                    </div>
                )}

                {/* BUSCENTA — always shown for BUSCENTA leaders; otherwise shown when an MC is selected */}
                {(targetBuscentas.length > 0 || selectedBuscenta) && (isBuscentaLeader || selectedMC) && (
                    <div className="relative">
                        <LayoutGrid size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-church-blue-400 pointer-events-none" />
                        <select
                            value={selectedBuscenta}
                            onChange={(e) => {
                                setSelectedBuscenta(e.target.value);
                                setSelectedCell('');
                            }}
                            className="w-full bg-[#0b1120] border border-slate-600/60 rounded-2xl pl-12 pr-10 py-4 text-sm font-bold text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-church-blue-500/50 focus:border-church-blue-500/50 transition-colors"
                        >
                            <option value="">-- ALL BUSCENTAS --</option>
                            {targetBuscentas.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
                    </div>
                )}

                {/* CELL */}
                {(targetCells.length > 0 || selectedCell) && selectedBuscenta && (
                    <div className="relative">
                        <LayoutGrid size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-church-blue-400 pointer-events-none" />
                        <select
                            value={selectedCell}
                            onChange={(e) => setSelectedCell(e.target.value)}
                            className="w-full bg-[#0b1120] border border-slate-600/60 rounded-2xl pl-12 pr-10 py-4 text-sm font-bold text-slate-200 appearance-none focus:outline-none focus:ring-2 focus:ring-church-blue-500/50 focus:border-church-blue-500/50 transition-colors"
                        >
                            <option value="">-- ALL CELLS --</option>
                            {targetCells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
                    </div>
                )}
            </div>
        </div>
    );
}
