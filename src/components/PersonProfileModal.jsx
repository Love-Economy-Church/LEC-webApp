import { User, Shield, MapPin, Activity } from 'lucide-react';
import Modal from './ui/Modal';

export default function PersonProfileModal({ isOpen, onClose, person }) {
    if (!person) return null;

    const { name, role, photo, unitName, isPlaceholder } = person;
    const isSystemUnitPlaceholder = isPlaceholder && name?.includes(' - Leader');
    const status = isSystemUnitPlaceholder ? 'System' : (isPlaceholder ? 'Placeholder' : 'Active');

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Member Profile"
            maxWidth="max-w-md"
        >
            <div className="flex flex-col items-center p-6 space-y-6">
                {/* Large Avatar */}
                <div className="w-32 h-32 rounded-full border-4 border-slate-700/50 shadow-2xl overflow-hidden bg-slate-800 flex items-center justify-center relative">
                    {photo ? (
                        <img src={photo} alt={name} className="w-full h-full object-cover" />
                    ) : (
                        <User size={64} className="text-slate-600" />
                    )}
                    {status === 'Active' && (
                        <div className="absolute bottom-1, right-4 w-5 h-5 bg-emerald-500 border-4 border-slate-900 rounded-full" />
                    )}
                </div>

                {/* Name & Badge */}
                <div className="text-center space-y-1">
                    <h2 className="text-2xl font-black text-white">{name}</h2>
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-church-blue-500/10 border border-church-blue-500/20 text-church-blue-400">
                        {role || 'Member'}
                    </span>
                </div>

                {/* Info Cards */}
                <div className="w-full space-y-3 pt-4 border-t border-slate-800">
                    <InfoCard 
                        label="Status" 
                        value={status} 
                        icon={<Activity size={18} />} 
                        color={status === 'Active' ? 'emerald' : 'amber'} 
                    />
                    <InfoCard 
                        label="Assigned Role" 
                        value={role || 'Member'} 
                        icon={<Shield size={18} />} 
                        color="blue" 
                    />
                    <InfoCard 
                        label="Church Unit" 
                        value={unitName || 'Unknown Unit'} 
                        icon={<MapPin size={18} />} 
                        color="purple" 
                    />
                </div>
            </div>
        </Modal>
    );
}

function InfoCard({ label, value, icon, color }) {
    const colors = {
        blue: 'text-church-blue-400 bg-church-blue-500/10',
        purple: 'text-church-purple-400 bg-church-purple-500/10',
        emerald: 'text-emerald-400 bg-emerald-500/10',
        amber: 'text-amber-400 bg-amber-500/10',
    };

    return (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 transition-all hover:bg-slate-800">
            <div className={`p-3 rounded-xl ${colors[color] || colors.blue}`}>
                {icon}
            </div>
            <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                <p className="text-base font-semibold text-slate-200">{value}</p>
            </div>
        </div>
    );
}
