import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ImageModal({ isOpen, onClose, imageSrc, title }) {
    const [isLoading, setIsLoading] = useState(true);

    // Reset loading state when image source changes
    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
        }
    }, [imageSrc, isOpen]);

    if (!imageSrc) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md cursor-pointer"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center z-10"
                    >
                        {/* Header/Controls */}
                        <div className="absolute -top-12 left-0 right-0 flex items-center justify-between text-white px-2">
                            <h3 className="font-bold text-lg truncate pr-4">{title || 'Profile Image'}</h3>
                            <div className="flex items-center gap-3">
                                <a 
                                    href={imageSrc} 
                                    download 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                    title="Open original"
                                >
                                    <Download size={20} />
                                </a>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Image Frame */}
                        <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl bg-slate-900 flex items-center justify-center relative min-h-[300px]">
                             {/* Rough Background Pattern (Consistent with theme) */}
                             <div className="absolute inset-0 bg-dot-pattern bg-dot-md text-church-blue-500 opacity-[0.02] pointer-events-none"></div>
                             
                             {/* Loading Spinner */}
                             {isLoading && (
                                 <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-900/50 backdrop-blur-sm">
                                     <Loader2 size={48} className="text-church-blue-500 animate-spin mb-4" />
                                     <span className="text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">Loading Profile...</span>
                                 </div>
                             )}

                            <img
                                src={imageSrc}
                                alt={title || 'Profile'}
                                onLoad={() => setIsLoading(false)}
                                className={`max-w-full max-h-[80vh] object-contain relative z-10 transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                            />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
