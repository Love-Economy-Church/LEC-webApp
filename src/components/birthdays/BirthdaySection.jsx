import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BirthdayFlyerCard, UpcomingBirthdayCard } from './BirthdayCard';

// Parse DOB as local date to avoid UTC offset shifting the day
function parseDobLocal(dob) {
    if (!dob) return null;
    const [year, month, day] = dob.split('-').map(Number);
    return new Date(year, month - 1, day); // local midnight
}

function isToday(dob) {
    if (!dob) return false;
    const today = new Date();
    const bday = parseDobLocal(dob);
    return today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate();
}

function daysUntilBirthday(dob) {
    if (!dob) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bday = parseDobLocal(dob);
    const next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    if (next <= today) next.setFullYear(today.getFullYear() + 1);
    return Math.ceil((next - today) / 86400000);
}

export default function BirthdaySection() {
    const [todayBirthdays, setTodayBirthdays] = useState([]);
    const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBirthdays();
    }, []);

    const fetchBirthdays = async () => {
        setLoading(true);
        try {
            // Fetch all active people with DOB and their unit info
            const { data, error } = await supabase
                .from('people')
                .select(`
                    id, full_name, photo_url, dob,
                    assignments:position_assignments(
                        position:positions(title),
                        unit:organizational_units(name)
                    )
                `)
                .eq('is_active', true)
                .eq('is_placeholder', false)
                .not('dob', 'is', null);

            if (error) throw error;

            const enriched = (data || []).map(p => {
                const activeAssign = p.assignments?.find(a => a.position && a.unit);
                return {
                    ...p,
                    position_title: activeAssign?.position?.title || '',
                    unit_name: activeAssign?.unit?.name || '',
                };
            });

            const today = enriched.filter(p => isToday(p.dob));
            const upcoming = enriched
                .filter(p => !isToday(p.dob))
                .map(p => ({ ...p, daysUntil: daysUntilBirthday(p.dob) }))
                .filter(p => p.daysUntil <= 7)
                .sort((a, b) => a.daysUntil - b.daysUntil);

            setTodayBirthdays(today);
            setUpcomingBirthdays(upcoming);
        } catch (err) {
            console.error('fetchBirthdays error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Hide section entirely if no birthdays
    if (!loading && todayBirthdays.length === 0 && upcomingBirthdays.length === 0) return null;

    return (
        <section>
            {/* Section Header */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">🎂</span>
                <h2 className="text-sm font-semibold text-white">Birthdays</h2>
                {todayBirthdays.length > 0 && (
                    <span className="ml-auto text-[10px] text-yellow-500 font-semibold">Today</span>
                )}
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[1, 2].map(i => (
                        <div key={i} className="h-14 rounded-2xl bg-white/[0.03] animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="space-y-1">
                    {/* Today's birthdays */}
                    {todayBirthdays.map(person => (
                        <BirthdayFlyerCard key={person.id} person={person} />
                    ))}

                    {/* Upcoming birthdays */}
                    {upcomingBirthdays.length > 0 && (
                        <>
                            {todayBirthdays.length > 0 && (
                                <p className="text-[10px] text-slate-600 uppercase tracking-widest pt-3 pb-1 font-semibold">
                                    This Week
                                </p>
                            )}
                            {upcomingBirthdays.map(person => (
                                <UpcomingBirthdayCard key={person.id} person={person} />
                            ))}
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
