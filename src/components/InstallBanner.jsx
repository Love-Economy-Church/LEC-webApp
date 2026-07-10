import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

/**
 * PWA Install Banner
 * Shows an "Add to Home Screen" prompt on Android/Chrome when the app is installable.
 * On iOS it shows a one-time tip (Safari doesn't support the beforeinstallprompt event).
 */
export default function InstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [show, setShow] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Don't show if already installed (running standalone)
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        // Don't show if user previously dismissed
        if (localStorage.getItem('pwa-install-dismissed')) return;

        const iOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
        setIsIOS(iOS);

        if (iOS) {
            // Show iOS tip after 3s
            setTimeout(() => setShow(true), 3000);
        }

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShow(true);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') dismiss();
        else setDeferredPrompt(null);
    };

    const dismiss = () => {
        setShow(false);
        setDismissed(true);
        localStorage.setItem('pwa-install-dismissed', '1');
    };

    if (!show || dismissed) return null;

    return (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm z-[999] animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900/95 backdrop-blur-xl border border-church-blue-500/40 rounded-2xl p-4 shadow-2xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-church-blue-500/30 shrink-0 bg-black/30">
                    <img src="/lec-logo.png" alt="LEC" className="w-full h-full object-contain p-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm leading-tight">Install LEC - Alpha</p>
                    {isIOS ? (
                        <p className="text-slate-400 text-xs mt-0.5">
                            Tap <span className="text-church-blue-400 font-bold">Share</span> → <span className="text-church-blue-400 font-bold">Add to Home Screen</span>
                        </p>
                    ) : (
                        <p className="text-slate-400 text-xs mt-0.5">Add to your home screen for offline access</p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {!isIOS && (
                        <button
                            onClick={handleInstall}
                            className="bg-gradient-church text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg hover:opacity-90 transition-opacity"
                        >
                            <Download size={14} />
                            Install
                        </button>
                    )}
                    <button
                        onClick={dismiss}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
