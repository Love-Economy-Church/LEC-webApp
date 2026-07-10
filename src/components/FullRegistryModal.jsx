import { User, Shield, Users } from 'lucide-react';
import Modal from './ui/Modal';
import { useState } from 'react';
import ImageModal from './common/ImageModal';

export default function FullRegistryModal({ isOpen, onClose, unitName, people = [] }) {
    const [imageModalConfig, setImageModalConfig] = useState({ isOpen: false, src: '', title: '' });

    // Group people by type for better organization
    const leaders = people.filter(p => p.type === 'LEADER').sort((a, b) => (a.level || 99) - (b.level || 99));
    const members = people.filter(p => p.type === 'MEMBER').sort((a, b) => a.name.localeCompare(b.name));

    const allPeople = [...leaders, ...members];

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={`${unitName} - Full Registry`} maxWidth="max-w-4xl">
                <div className="space-y-6">
                    <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-church-blue-500/30">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-lg bg-church-blue-500/20 text-church-blue-400">
                                <Users size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white leading-tight">Consolidated Registry</h3>
                                <p className="text-sm text-slate-400 font-semibold">{allPeople.length} People Total</p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/50">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-800/80 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Unit</th>
                                    <th className="px-4 py-3 text-center">Type</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {allPeople.map((person, i) => (
                                    <tr key={`${person.id}-${i}`} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    onClick={() => person.photo && setImageModalConfig({ isOpen: true, src: person.photo, title: person.name })}
                                                    className={`w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 group-hover:border-church-blue-500/50 transition-colors ${person.photo ? 'cursor-pointer' : ''}`}
                                                >
                                                    {person.photo ? (
                                                        <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User size={14} className="text-slate-600" />
                                                    )}
                                                </div>
                                                <span className="font-bold text-slate-200 group-hover:text-white">{person.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {person.type === 'LEADER' && <Shield size={12} className="text-emerald-400" />}
                                                <span className="text-slate-400 group-hover:text-slate-300">{person.role}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 font-medium italic group-hover:text-slate-400">
                                            {person.unitName}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                                                person.type === 'LEADER' 
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                    : 'bg-slate-700/30 text-slate-500 border border-slate-700/50'
                                            }`}>
                                                {person.type}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {allPeople.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="p-12 text-center text-slate-600 font-medium">
                                            No registry data available for this unit.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>

            <ImageModal
                isOpen={imageModalConfig.isOpen}
                onClose={() => setImageModalConfig(prev => ({ ...prev, isOpen: false }))}
                imageSrc={imageModalConfig.src}
                title={imageModalConfig.title}
            />
        </>
    );
}
