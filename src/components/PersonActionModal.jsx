import { useForm } from 'react-hook-form';
import { User, Shield, MapPin, Save, X, Mail } from 'lucide-react';
import Modal from './ui/Modal';
import { useEffect } from 'react';

export default function PersonActionModal({ 
    isOpen, 
    onClose, 
    mode = 'add', 
    person = null, 
    units = [], 
    positions = [], 
    lockUnit = false,
    onSubmit 
}) {
    const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm();

    const selectedUnitId = watch('unitId');
    const selectedPositionId = watch('positionId');

    // Filter available positions based on selected unit's type
    const availablePositions = (selectedUnitId, units, positions) => {
        if (!selectedUnitId) return [];
        const unit = units.find(u => u.id === selectedUnitId);
        if (!unit) return [];
        return positions.filter(p => p.unit_type === unit.unit_type);
    };

    const currentPositions = availablePositions(selectedUnitId, units, positions);
    const selectedPosition = currentPositions.find(p => p.id === selectedPositionId);
    
    // Sort units naturally so they appear in correct alphabetical/chronological order (e.g. Cell 1 -> Cell 2 -> Cell 3)
    const sortedUnits = [...units].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    useEffect(() => {
        if (mode === 'edit' && person) {
            reset({
                fullName: person.name,
                personalEmail: person.personal_email || '',
                unitId: person.unit_id || '',
                positionId: person.position_id || ''
            });
        } else {
            // In add mode, pre-fill unit_id if provided (e.g. when locked to a cell for first-timer registration)
            reset({ fullName: '', personalEmail: '', unitId: person?.unit_id || '', positionId: '' });
        }
    }, [mode, person, reset, isOpen]);

    // Auto-select the 'First Timer' or 'Member' position when unit is locked (first-timer registration flow)
    useEffect(() => {
        if (lockUnit && currentPositions.length > 0) {
            const targetPos = currentPositions.find(p =>
                p.title === 'First Timer' || 
                p.title === 'First-timer' || 
                p.title === 'First-Timer' || 
                p.title === 'First Timers'
            ) || currentPositions.find(p =>
                p.title === 'Member' || 
                p.title === 'Cell Member'
            );
            if (targetPos) setValue('positionId', targetPos.id);
        }
    }, [lockUnit, currentPositions, setValue]);

    const handleFormSubmit = async (data) => {
        await onSubmit(data);
        onClose();
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={mode === 'add' ? "Add New Member" : "Edit Member Profile"}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                
                {/* Profile Header (Edit Mode) */}
                {mode === 'edit' && person && (
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                        <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-church-blue-500/30">
                            {person.photo ? (
                                <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                            ) : (
                                <User size={32} className="text-slate-500" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white">{person.name}</h3>
                            <p className="text-xs text-church-blue-400 font-bold uppercase tracking-wider">{person.role} • {person.unit}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1">Basic Information</div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">Full Name</label>
                            <div className="relative group">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-church-blue-400 transition-colors" size={16} />
                                <input
                                    {...register('fullName', { required: 'Name is required' })}
                                    className="w-full bg-slate-900 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-church-blue-500/50 focus:ring-2 focus:ring-church-blue-500/50 transition-all text-slate-200"
                                    placeholder="John Doe"
                                />
                            </div>
                            {errors.fullName && <span className="text-church-coral-400 text-[10px] font-bold mt-1 block ml-1">{errors.fullName.message}</span>}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">Personal Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-church-blue-400 transition-colors" size={16} />
                                <input
                                    {...register('personalEmail', { required: !lockUnit ? 'Personal email is required' : false })}
                                    type="email"
                                    className="w-full bg-slate-900 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-church-blue-500/50 focus:ring-2 focus:ring-church-blue-500/50 transition-all text-slate-200"
                                    placeholder="john.doe@gmail.com"
                                />
                            </div>
                            {errors.personalEmail && <span className="text-church-coral-400 text-[10px] font-bold mt-1 block ml-1">{errors.personalEmail.message}</span>}
                        </div>
                    </div>

                    {/* Organizational Placement */}
                    <div className="space-y-4">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1">Church Placement</div>

                        {lockUnit ? (
                            // ── Locked first-timer flow: show clean badges instead of dropdowns ──
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                                    <MapPin size={15} className="text-church-blue-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">ASSIGNED CELL</p>
                                        <p className="text-sm font-bold text-slate-200 truncate">
                                            {sortedUnits.find(u => u.id === person?.unit_id)?.name || 'CURRENT CELL'}
                                        </p>
                                    </div>
                                    <span className="text-[8px] font-black uppercase tracking-wider text-church-blue-400 bg-church-blue-500/10 border border-church-blue-500/20 px-2 py-0.5 rounded-full shrink-0">Locked</span>
                                </div>
                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                                    <Shield size={15} className="text-emerald-400 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Role</p>
                                        <p className="text-sm font-bold text-slate-200">
                                            {selectedPosition?.title || 'First Timer'}
                                        </p>
                                    </div>
                                    <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">Auto</span>
                                </div>
                                {/* Hidden inputs to keep form values registered */}
                                <input type="hidden" {...register('unitId', { required: true })} />
                                <input type="hidden" {...register('positionId', { required: true })} />
                            </div>
                        ) : (
                            // ── Full edit/add flow: show dropdowns ──
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">ASSIGNED UNIT</label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-church-blue-400 transition-colors" size={16} />
                                        <select
                                            {...register('unitId', { required: 'Unit is required' })}
                                            className="w-full bg-slate-900 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-church-blue-500/50 focus:ring-2 focus:ring-church-blue-500/50 transition-all text-slate-200 appearance-none"
                                        >
                                            <option value="">Select Unit...</option>
                                            {sortedUnits.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
                                            ))}
                                        </select>
                                    </div>
                                    {errors.unitId && <span className="text-church-coral-400 text-[10px] font-bold mt-1 block ml-1">{errors.unitId.message}</span>}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">Position / Role</label>
                                    <div className="relative group">
                                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-church-blue-400 transition-colors" size={16} />
                                        <select
                                            {...register('positionId', { required: 'Role is required' })}
                                            className="w-full bg-slate-900 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-church-blue-500/50 focus:ring-2 focus:ring-church-blue-500/50 transition-all text-slate-200 appearance-none disabled:opacity-50"
                                            disabled={!currentPositions.length}
                                        >
                                            <option value="">Select Role...</option>
                                            {currentPositions
                                                .filter(p => p.title !== 'First Timer' && p.title !== 'First-timer' && p.title !== 'First-Timer' && p.title !== 'First Timers')
                                                .map(p => (
                                                    <option key={p.id} value={p.id}>{p.title}</option>
                                                ))}
                                        </select>
                                    </div>
                                    {errors.positionId && <span className="text-church-coral-400 text-[10px] font-bold mt-1 block ml-1">{errors.positionId.message}</span>}
                                </div>

                                <div className="pt-2">
                                    <p className="text-[10px] text-slate-500 italic px-1 leading-relaxed">
                                        Note: Changing the unit or role will automatically transfer the member to the new location in the hierarchy.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-4 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700 font-bold flex items-center justify-center gap-2"
                    >
                        <X size={18} />
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-[2] py-3 rounded-xl bg-gradient-church text-white font-black hover:opacity-90 transition-all shadow-lg border-2 border-church-blue-600 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Save size={18} />
                                {mode === 'add' ? 'Register Member' : 'Save Profile Changes'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
