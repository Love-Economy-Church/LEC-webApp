import { IonPage, IonContent, useIonToast } from '@ionic/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { fetchPeople, createPerson, updatePerson, deactivatePerson, reactivatePerson, setPendingPerson } from '../services/peopleService';
import { fetchHierarchyData, fetchPositions } from '../services/hierarchyService';
import { Search, ArrowUpDown, User, Plus, Edit, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import ImageModal from '../components/common/ImageModal';
import PersonActionModal from '../components/PersonActionModal';
import StatusDropdown from '../components/ui/StatusDropdown';
import { useAuth } from '../contexts/AuthContext';

export default function PeopleDirectory() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, userRole, getManagedUnits } = useAuth();
    const [presentToast] = useIonToast();
    const [people, setPeople] = useState([]);
    const [managedUnitIds, setManagedUnitIds] = useState(new Set());
    const [isAllManaged, setIsAllManaged] = useState(false);
    const [units, setUnits] = useState([]);
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [changingStatusId, setChangingStatusId] = useState(null);
    const [imageModalConfig, setImageModalConfig] = useState({ isOpen: false, src: '', title: '' });
    
    const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm();

    // Watch selected unit to filter roles
    const selectedUnitId = watch('unitId');

    // Filter available positions based on selected unit
    const availablePositions = useMemo(() => {
        if (!selectedUnitId) return [];
        // Determine unit type. 'units' state contains hierarchy, but it might be nested if fetched raw?
        // Ah, fetchHierarchyData returns units with leaders. It's a flat array of units.
        const unit = units.find(u => u.id === selectedUnitId);
        if (!unit) return [];
        return positions.filter(p => p.unit_type === unit.unit_type);
    }, [selectedUnitId, units, positions]);

    useEffect(() => {
        Promise.all([
            fetchPeople(),
            fetchHierarchyData(),
            fetchPositions()
        ]).then(async ([peopleData, unitsData, positionsData]) => {
            setPeople(peopleData);
            setUnits(unitsData); // This is flat array of units
            setPositions(positionsData);
            
            // Pre-calculate which units this user is allowed to manage (RBAC)
            if (userRole) {
                 try {
                     const allowed = await getManagedUnits();
                     if (allowed === 'ALL') {
                         setIsAllManaged(true);
                         setManagedUnitIds(new Set());
                     } else {
                         setIsAllManaged(false);
                         setManagedUnitIds(allowed);
                     }
                 } catch(e) {
                     console.error("Failed to load managed units:", e);
                     setIsAllManaged(false);
                     setManagedUnitIds(new Set());
                 }
            }
            
        }).finally(() => setLoading(false));
    }, [userRole, getManagedUnits]);

    // Handle incoming URL parameters
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('filter') === 'first_timers') {
            setSearchTerm('First Timer');
        }
    }, [location.search]);

    // Base filtered people (RBAC applied)
    const basePeople = useMemo(() => {
        return people.filter(p => {
            if (user && !isAllManaged && !managedUnitIds.has(p.unit_id)) {
                return false;
            }
            // Hide staging members/first timers who are not yet Brethren or Members
            if (p.membership_state === 'First Timer') {
                return false;
            }
            return true;
        });
    }, [people, user, isAllManaged, managedUnitIds]);

    // Unique Roles for Filter
    const roles = useMemo(() => {
        const unique = new Set(people.map(p => p.role));
        return ['All', ...Array.from(unique).sort()];
    }, [people]);

    // Status counts for filter tabs
    const statusCounts = useMemo(() => {
        const counts = { All: people.length, Active: 0, Inactive: 0, Pending: 0 };
        people.forEach(p => {
            const s = (p.status || 'Active').toLowerCase();
            if (s === 'active') counts.Active++;
            else if (s === 'inactive') counts.Inactive++;
            else if (s === 'pending') counts.Pending++;
        });
        return counts;
    }, [people]);

    const filteredPeople = useMemo(() => {
        let filtered = people.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.membership_state || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = filterRole === 'All' || p.role === filterRole;
            const matchesStatus = filterStatus === 'All' || 
                (p.status || 'Active').toLowerCase() === filterStatus.toLowerCase();
            return matchesSearch && matchesRole && matchesStatus;
        });

        return filtered.sort((a, b) => {
            const valA = (a[sortConfig.key] || '').toString().toLowerCase();
            const valB = (b[sortConfig.key] || '').toString().toLowerCase();

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [people, searchTerm, filterRole, filterStatus, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Handlers
    const openAddModal = () => {
        setModalMode('add');
        setSelectedPerson(null);
        reset({ fullName: '', unitId: '', positionId: '' });
        setIsActionModalOpen(true);
    };

    const openEditModal = (person) => {
        setModalMode('edit');
        setSelectedPerson(person);
        setIsActionModalOpen(true);
    };

    const handleStatusChange = async (person, newStatus) => {
        setChangingStatusId(person.id);
        try {
            if (newStatus === 'Inactive') {
                await deactivatePerson(person.id);
            } else if (newStatus === 'Active') {
                await reactivatePerson(person.id);
            } else if (newStatus === 'Pending') {
                await setPendingPerson(person.id);
            }
            // Update local state
            const updateStatus = p => p.id === person.id ? { ...p, status: newStatus } : p;
            setPeople(prev => prev.map(updateStatus));
            setBasePeople(prev => prev.map(updateStatus));
        } catch (err) {
            console.error(`Failed to change status to ${newStatus}:`, err);
            alert(`Failed to update status`);
        } finally {
            setChangingStatusId(null);
        }
    };

    const handleActionSubmit = async (data) => {
        try {
            if (modalMode === 'add') {
                const response = await createPerson(data);
                const newPerson = response.person;
                const added = {
                    ...newPerson,
                    name: newPerson.full_name,
                    role: positions.find(p => p.id === data.positionId)?.title || 'Unassigned',
                    unit: units.find(u => u.id === data.unitId)?.name || 'Unassigned',
                    status: 'Active'
                };
                setPeople(prev => [...prev, added]);
                setBasePeople(prev => [...prev, added]);
                if (response.login) {
                    // Show credentials so the admin can give them to the user
                    alert(`Person successfully added!\n\nLogin Email: ${response.login.email}\nPassword: ${response.login.password}\n\nPlease save these credentials!`);
                }
            } else {
                const updated = await updatePerson(selectedPerson.id, data);
                // Use the DB response name, but fall back to the form value if the
                // DB returned null (e.g. silent RLS failure that doesn't throw)
                const newName = updated?.full_name || data.fullName || selectedPerson.name;
                const updateItem = p => p.id === selectedPerson.id ? { 
                    ...p, 
                    name: newName,
                    role: positions.find(pos => pos.id === data.positionId)?.title || p.role,
                    unit: units.find(un => un.id === data.unitId)?.name || p.unit
                } : p;
                setPeople(prev => prev.map(updateItem));
                setBasePeople(prev => prev.map(updateItem));
            }
            setIsActionModalOpen(false);
            presentToast({
                message: modalMode === 'add' ? 'Person successfully added.' : 'Changes saved.',
                duration: 2000,
                position: 'bottom',
                color: 'dark',
            });
        } catch (err) {
            console.error("Failed to save:", err);
            alert(`Failed to save changes: ${err?.message || err}`);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-church-blue-500"></div>
        </div>
    );

    return (
        // <IonPage>
            // <IonContent className="ion-padding-bottom bg-[#000000]">
                <div className="space-y-6">

            <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-4xl font-black text-white leading-tight">
                    People <span className="text-church-blue-400">Directory</span>
                </h1>
                <p className="text-slate-400 text-sm mt-1 font-semibold">{basePeople.length} Members</p>
            </div>

            {/* Search */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-church-blue-400 transition-colors" size={18} />
                <input
                    type="text"
                    placeholder="Search people..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-transparent border border-slate-600/60 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-church-blue-500/50 focus:border-church-blue-500/50 transition-colors placeholder:text-slate-500"
                />
            </div>

            {/* Status Filter Tabs - Scrollable with Gradient Fade on Mobile */}
            <div className="relative w-full overflow-hidden">
                <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pr-12 pb-px relative z-10">
                    {['All', 'Active', 'Inactive', 'Pending'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`relative whitespace-nowrap pb-3 text-sm font-black transition-colors duration-200 flex items-center gap-2 ${
                                filterStatus === status
                                    ? 'text-church-blue-400'
                                    : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            <span>{status}</span>
                            <span className="text-xs font-bold opacity-60">
                                {statusCounts[status]}
                            </span>
                            {filterStatus === status && (
                                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-church-blue-500 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
                {/* Horizontal scroll fade out indicator */}
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#020617] to-transparent pointer-events-none z-20 md:hidden" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-700/50" />
            </div>

            {/* Premium Table / Card List */}
            <div className="w-full">
                <div className="space-y-2">
                    {filteredPeople.map((person) => (
                        <motion.div
                            key={person.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border border-slate-700/40 hover:border-slate-600/60 hover:bg-white/[0.01] transition-all"
                        >
                            <div 
                                onClick={() => navigate(`/directory/${person.id}`)}
                                className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                            >
                                {/* Avatar/Photo */}
                                <div 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        person.photo && setImageModalConfig({ isOpen: true, src: person.photo, title: person.name });
                                    }}
                                    className={`w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-white/5 shadow-sm transition-transform hover:scale-105 ${person.photo ? 'cursor-pointer' : ''}`}
                                >
                                    {person.photo ? (
                                        <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={18} className="text-slate-500" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-slate-200 text-sm md:text-base truncate leading-snug">{person.name}</span>
                                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">

                                        {/* Placeholder badge */}
                                        {person.is_placeholder && (
                                            <div className="text-[7px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-0.5">
                                                <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></span> Virtual Placeholder
                                            </div>
                                        )}

                                        {/* Role & Unit info as compact tags */}
                                        <span className="text-church-blue-400 font-black text-[8px] uppercase tracking-wider">{person.role}</span>
                                        <span className="text-slate-400 font-bold text-[8px] flex items-center gap-0.5 uppercase tracking-wider">
                                            <MapPin size={8} className="text-slate-500 shrink-0" /> {person.unit}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side Actions */}
                            <div className="flex items-center justify-end gap-2 shrink-0">
                                <StatusDropdown
                                    status={person.status}
                                    canManage={user && (isAllManaged || managedUnitIds.has(person.unit_id))}
                                    onStatusChange={(newStatus) => handleStatusChange(person, newStatus)}
                                    loading={changingStatusId === person.id}
                                />
                                {user && (isAllManaged || managedUnitIds.has(person.unit_id)) && (
                                    <button
                                        onClick={() => openEditModal(person)}
                                        className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-church-blue-500/20 text-slate-400 hover:text-church-blue-400 transition-all flex items-center justify-center border border-white/5"
                                        title="Edit Profile"
                                    >
                                        <Edit size={12} />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {filteredPeople.length === 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="p-20 text-center space-y-4"
                    >
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto border border-white/5 shadow-2xl">
                             <User size={32} className="text-slate-700" />
                        </div>
                        <div>
                            <p className="text-slate-100 font-black text-xl">No members found</p>
                            <p className="text-slate-500 text-sm">Try adjusting your search or filters.</p>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Modals */}
            <PersonActionModal
                isOpen={isActionModalOpen}
                onClose={() => setIsActionModalOpen(false)}
                mode={modalMode}
                person={selectedPerson}
                units={user && !isAllManaged ? units.filter(u => managedUnitIds.has(u.id)) : units}
                positions={positions}
                onSubmit={handleActionSubmit}
            />


            {/* Floating Action Button (FAB) for Add Member - Protected by RBAC */}
            {user && (isAllManaged || managedUnitIds.size > 0) && (
                <button
                    onClick={openAddModal}
                    className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-50 bg-gradient-church hover:opacity-90 text-white p-4 rounded-full font-black flex items-center justify-center transition-all shadow-xl shadow-church-blue-500/30 active:scale-95 border-2 border-church-blue-400 hover:scale-105 group"
                    title="Add Member"
                >
                    <Plus size={28} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
            )}

            <ImageModal
                isOpen={imageModalConfig.isOpen}
                onClose={() => setImageModalConfig(prev => ({ ...prev, isOpen: false }))}
                imageSrc={imageModalConfig.src}
                title={imageModalConfig.title}
            />
            </div>
        </div>
            // </IonContent>
        // </IonPage>
  );
}

