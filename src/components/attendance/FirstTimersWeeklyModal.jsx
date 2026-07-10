import { useMemo } from 'react';
import { X, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FirstTimersWeeklyModal({ isOpen, onClose, attendanceData = [] }) {
    // Get the start of the current week (Sunday)
    const weekStart = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = today.getDay(); // 0 = Sunday
        const sunday = new Date(today);
        sunday.setDate(sunday.getDate() - dayOfWeek);
        return sunday;
    }, []);

    const weekEnd = useMemo(() => {
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return end;
    }, [weekStart]);

    // Filter and group attendance data for this week
    const weeklyServices = useMemo(() => {
        if (!attendanceData || attendanceData.length === 0) return [];

        const grouped = {};
        
        attendanceData.forEach(row => {
            const dateStr = row.session_date;
            const d = new Date(dateStr + 'T00:00:00');
            
            // Only include records from this week
            if (d >= weekStart && d <= weekEnd) {
                const sName = row.service_name || 'Unnamed Service';
                const key = `${dateStr}_${sName}`;
                
                if (!grouped[key]) {
                    grouped[key] = {
                        serviceName: sName,
                        date: d,
                        firstTimers: 0
                    };
                }
                grouped[key].firstTimers += (row.first_timers_count || 0);
            }
        });

        return Object.values(grouped)
            .sort((a, b) => b.date - a.date); // Sort by newest first
    }, [attendanceData, weekStart, weekEnd]);

    const totalFirstTimers = weeklyServices.reduce((sum, s) => sum + s.firstTimers, 0);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {/* Popover */}
            <motion.div
                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden"
            >
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800/50">
                        <div className="flex items-center gap-2">
                            <UserPlus size={14} className="text-church-purple-400" />
                            <h3 className="text-sm font-black text-white">This Week</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-4 py-3">
                        {weeklyServices.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-4 font-semibold">
                                No services recorded this week yet.
                            </p>
                        ) : (
                            <div className="space-y-2.5">
                                {weeklyServices.map((service, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-200 truncate">{service.serviceName}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">
                                                {service.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                        <span className="text-lg font-black text-white tabular-nums ml-3 shrink-0">
                                            {service.firstTimers}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {weeklyServices.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-slate-800/50 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total</span>
                            <span className="text-sm font-black text-church-purple-400 tabular-nums">{totalFirstTimers}</span>
                        </div>
                    )}
                </motion.div>
        </AnimatePresence>
    );
}
