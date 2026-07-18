import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Loader2, MessageCircle } from 'lucide-react';
import html2canvas from 'html2canvas';

function getInitials(name = '') {
    return name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

// Parse DOB as local date to avoid UTC offset shifting the day
function parseDobLocal(dob) {
    if (!dob) return null;
    const [year, month, day] = dob.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function daysUntilBirthday(dob) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bday = parseDobLocal(dob);
    const next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    if (next <= today) next.setFullYear(today.getFullYear() + 1);
    return Math.ceil((next - today) / 86400000);
}

function isToday(dob) {
    const today = new Date();
    const bday = parseDobLocal(dob);
    return today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate();
}

// ── Today's Birthday Flyer Card (minimal vertical) ────────────────────────
export function BirthdayFlyerCard({ person }) {
    const navigate = useNavigate();
    const flyerRef = useRef(null);
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        if (!flyerRef.current) return;
        setDownloading(true);
        try {
            // Using higher scale for a high-res exported image
            const canvas = await html2canvas(flyerRef.current, {
                useCORS: true,
                allowTaint: true,
                scale: 3,
                backgroundColor: '#0a0f1d', // Solid matching dark background for output image
                logging: false,
            });
            const link = document.createElement('a');
            link.download = `Birthday-Flyer-${person.full_name.replace(/\s+/g, '-')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Download failed:', err);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
        >
            {/* The actual flyer content to capture */}
            <div
                ref={flyerRef}
                className="relative rounded-2xl bg-white/[0.04] border border-white/[0.07] overflow-hidden"
            >
                {/* Subtle top accent */}
                <div className="h-[2px] w-full bg-gradient-to-r from-violet-500/50 via-blue-400/50 to-cyan-400/50" />

                {/* Flyer body — centered */}
                <div className="flex flex-col items-center text-center px-6 pt-6 pb-6 gap-3">
                    {/* Label */}
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400/70">🎂 Birthday Today</p>

                    {/* Photo */}
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center">
                        {person.photo_url
                            ? <img src={person.photo_url} alt={person.full_name} className="w-full h-full object-cover" crossOrigin="anonymous" />
                            : <span className="text-white font-bold text-2xl">{getInitials(person.full_name)}</span>
                        }
                    </div>

                    {/* Info */}
                    <div>
                        <h3 className="text-white font-bold text-lg leading-tight">{person.full_name}</h3>
                        {person.position_title && (
                            <p className="text-slate-500 text-xs mt-0.5">{person.position_title}</p>
                        )}
                        {person.unit_name && (
                            <p className="text-slate-600 text-[10px] uppercase tracking-wider mt-0.5">{person.unit_name}</p>
                        )}
                    </div>

                    {/* Wish Note */}
                    <p className="text-slate-200 text-xs font-medium leading-relaxed max-w-[250px] mt-2 px-2">
                        Happy Birthday. We love and cherish you dearly. We're glad you're part of this wonderful family. God richly Bless you
                    </p>
                </div>
            </div>

            {/* Buttons (not captured in download) */}
            <div className="flex gap-2">
                <button
                    onClick={() => navigate('/chats', { state: { openChatWith: person } })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/[0.10] hover:bg-white/[0.04] text-slate-400 hover:text-white text-xs font-semibold transition-all active:scale-[0.98]"
                >
                    <MessageCircle size={13} />
                    Send Wishes
                </button>
                <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/[0.10] hover:bg-white/[0.04] text-slate-400 hover:text-white text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                >
                    {downloading ? (
                        <>
                            <Loader2 size={13} className="animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Download size={13} />
                            Download
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
}

// ── Upcoming Birthday Row ─────────────────────────────────────────────────
export function UpcomingBirthdayCard({ person }) {
    const navigate = useNavigate();
    const days = daysUntilBirthday(person.dob);

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/chats', { state: { openChatWith: person } })}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer group"
        >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
                {person.photo_url
                    ? <img src={person.photo_url} alt={person.full_name} className="w-full h-full object-cover" />
                    : <span className="text-white font-bold text-[11px]">{getInitials(person.full_name)}</span>
                }
            </div>

            {/* Name */}
            <p className="flex-1 text-slate-300 text-xs font-medium truncate group-hover:text-white transition-colors">
                {person.full_name}
            </p>

            {/* Days badge */}
            <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                {days === 1 ? 'Tomorrow' : `in ${days}d`}
            </span>
        </motion.div>
    );
}
