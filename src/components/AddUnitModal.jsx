import { useForm } from 'react-hook-form';
import { Plus, Layout, Info } from 'lucide-react';
import Modal from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';

export default function AddUnitModal({ isOpen, onClose, parentNode, onSubmit }) {
    const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm();
    const { canManage } = useAuth();

    if (!parentNode) return null;

    const parentType = parentNode.data.unit_type;
    const parentName = parentNode.data.label;

    // Determine target child type
    let childType = 'CELL';
    let childLabel = 'Cell';
    let placeholder = 'e.g. AGB Cell 01, GB Cell 01...';
    
    if (parentType === 'ROOT') { 
        childType = 'BRANCH'; 
        childLabel = 'Branch'; 
        placeholder = 'e.g. Alpha Branch, Covenant Branch...';
    } else if (parentType === 'BRANCH') { 
        childType = 'CHURCH'; 
        childLabel = 'Church'; 
        placeholder = 'e.g. ChurchOne, ChurchTwo...';
    } else if (parentType === 'CHURCH') { 
        childType = 'MC'; 
        childLabel = 'Mega Center (MC)'; 
        placeholder = 'e.g. New Testament MC, Agape MC...';
    } else if (parentType === 'MC') { 
        childType = 'BUSCENTA'; 
        childLabel = 'Buscenta'; 
        placeholder = 'e.g. Grace Buscenta, Abundant Grace Buscenta...';
    } else if (parentType === 'BUSCENTA') { 
        childType = 'CELL'; 
        childLabel = 'Cell'; 
        placeholder = 'e.g. AGB Cell 01, GB Cell 01...';
    }

    const handleInternalSubmit = async (data) => {
        // Final security check before attempting creation
        const hasAccess = await canManage(parentNode.id);
        
        if (!hasAccess) {
             setError('root', { type: 'manual', message: 'You do not have permission to add structures here.' });
             return;
        }

        await onSubmit({
            ...data,
            unit_type: childType,
            parent_id: parentNode.id
        });
        reset();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Create New ${childLabel}`}>
            <form onSubmit={handleSubmit(handleInternalSubmit)} className="space-y-5">
                {/* Context Tip */}
                <div className="flex gap-3 p-4 rounded-xl bg-church-blue-500/10 border border-church-blue-500/20">
                    <Info className="text-church-blue-400 shrink-0" size={18} />
                    <p className="text-xs text-slate-400 leading-relaxed">
                        You are adding a new <span className="text-church-blue-400 font-bold">{childLabel}</span> under 
                        <span className="text-white font-bold ml-1">{parentName}</span>.
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest ml-1">
                        {childLabel} Name
                    </label>
                    <div className="relative group">
                        <Layout className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-church-blue-400 transition-colors" size={18} />
                        <input
                            {...register('name', { required: 'Unit name is required' })}
                            className="w-full bg-slate-900 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-church-blue-500/50 focus:ring-2 focus:ring-church-blue-500/50 transition-all text-slate-200 font-medium placeholder:text-slate-600"
                            placeholder={placeholder}
                            autoFocus
                        />
                    </div>
                    {errors.name && <span className="text-church-coral-400 text-[10px] font-bold uppercase ml-1">{errors.name.message}</span>}
                </div>

                {errors.root && (
                    <div className="p-3 rounded-lg bg-church-coral-500/10 border border-church-coral-500/30 text-church-coral-400 text-xs font-bold font-black uppercase tracking-widest text-center">
                        {errors.root.message}
                    </div>
                )}

                <div className="pt-2 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all font-bold border border-slate-700"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 py-3 rounded-xl bg-gradient-church text-white font-black hover:opacity-90 transition-all shadow-lg border-2 border-church-blue-600 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                             <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-b-transparent"></div>
                        ) : <Plus size={18} />}
                        {isSubmitting ? 'Creating...' : 'Create Unit'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
