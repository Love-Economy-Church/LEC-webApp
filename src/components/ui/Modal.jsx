import { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) {
    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className={`relative w-full ${maxWidth} bg-slate-900 border-2 border-church-blue-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/50">
                        <h2 className="text-xl font-black text-white tracking-tight">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="p-6 overflow-y-auto custom-scrollbar">
                        {children}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
