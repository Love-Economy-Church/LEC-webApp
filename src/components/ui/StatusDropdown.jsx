import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Circle } from 'lucide-react';

const STATUS_CONFIG = {
    Active: {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/20',
        dot: 'bg-emerald-400',
        hoverBg: 'hover:bg-emerald-500/20',
    },
    Inactive: {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/20',
        dot: 'bg-red-400',
        hoverBg: 'hover:bg-red-500/20',
    },
    Pending: {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/20',
        dot: 'bg-amber-400',
        hoverBg: 'hover:bg-amber-500/20',
    },
};

const STATUSES = ['Active', 'Inactive', 'Pending'];

/**
 * A beautiful inline status dropdown that replaces the old delete/reactivate buttons.
 * When clicked, it shows a mini dropdown to switch between Active, Inactive, and Pending.
 * Only renders the dropdown trigger if the user has permission (canManage=true).
 */
export default function StatusDropdown({ status, canManage, onStatusChange, loading = false }) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const currentConfig = STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
    const normalizedStatus = status || 'Pending';

    // Read-only badge (no permission or loading)
    if (!canManage) {
        return (
            <span 
                className={`flex items-center justify-center w-6 h-6 rounded-full border ${currentConfig.bg} ${currentConfig.border}`} 
                title={normalizedStatus}
            >
                <span className={`w-2 h-2 rounded-full ${currentConfig.dot}`} />
            </span>
        );
    }

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            {/* Clickable trigger - minimalist dot */}
            <button
                onClick={() => setOpen(!open)}
                disabled={loading}
                title={normalizedStatus}
                className={`
                    relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300
                    ${currentConfig.bg} border border-transparent hover:${currentConfig.border}
                    hover:scale-110 hover:shadow-[0_0_15px_rgba(0,0,0,0.5)] 
                    hover:shadow-${currentConfig.dot}/20
                    active:scale-95 group focus:outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed
                `}
            >
                {loading ? (
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                    <>
                        {/* The status dot */}
                        <span className={`w-2.5 h-2.5 rounded-full ${currentConfig.dot} shadow-[0_0_8px_currentColor]`} />
                        
                        {/* Tiny chevron that appears on hover, giving a hint it's a dropdown */}
                        <ChevronDown 
                            size={10} 
                            className={`absolute right-1 opacity-0 group-hover:opacity-100 transition-all duration-300 text-slate-400 ${open ? 'rotate-180 opacity-100' : ''}`} 
                        />
                    </>
                )}
            </button>

            {/* Dropdown menu */}
            {open && (
                <div className="absolute z-50 mt-2 right-0 w-40 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="p-1.5 space-y-0.5">
                        {STATUSES.map((s) => {
                            const config = STATUS_CONFIG[s];
                            const isSelected = s === normalizedStatus;
                            return (
                                <button
                                    key={s}
                                    onClick={() => {
                                        if (s !== normalizedStatus) {
                                            onStatusChange(s);
                                        }
                                        setOpen(false);
                                    }}
                                    className={`
                                        w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all
                                        ${isSelected ? `${config.bg} ${config.text}` : `text-slate-400 ${config.hoverBg} hover:${config.text}`}
                                    `}
                                >
                                    <span className={`w-2 h-2 rounded-full ${config.dot} ${!isSelected ? 'opacity-40' : ''}`} />
                                    <span className="flex-1 text-left">{s}</span>
                                    {isSelected && <Check size={12} className="opacity-60" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
