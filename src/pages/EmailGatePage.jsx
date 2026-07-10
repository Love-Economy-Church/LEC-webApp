import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function EmailGatePage() {
  const { user, userRole, signOut, EMAIL_GATE_ACTIVATION_DATE } = useAuth();
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState('');

  const formattedDate = (() => {
    const d = new Date(EMAIL_GATE_ACTIVATION_DATE + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  const handleLinkViaGoogle = async () => {
    if (!userRole?.personId) {
      setError('Could not identify your account. Please sign out and try again.');
      return;
    }

    setLoading(true);
    setError('');

    // Store the person ID so AuthCallbackPage can use it after the OAuth redirect
    sessionStorage.setItem('linking_person_id', userRole.personId);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?mode=link`,
          // Prompt the user to pick a Google account (in case they have multiple)
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      // Browser will redirect to Google — loading stays true during redirect
    } catch (err) {
      setError(err.message || 'Failed to start Google sign-in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-dark relative overflow-hidden">
      {/* Decorative Dot Pattern */}
      <div className="absolute inset-0 bg-dot-pattern bg-dot-md text-church-blue-500 opacity-[0.03]" />

      <div className="bg-black/60 backdrop-blur-xl border-2 border-church-blue-500/30 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative z-10">

        {/* Header row */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-church-blue-500 animate-pulse" />
            <span className="text-xs font-black uppercase text-church-blue-400 tracking-[0.2em]">
              Security Upgrade
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-xs font-bold border border-white/10"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Icon + Title */}
          <div className="text-center mb-7">
            <div className="w-16 h-16 rounded-full bg-church-blue-500/10 border border-church-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="text-church-blue-400" size={30} />
            </div>
            <h2 className="text-2xl font-black text-white">Verify Your Gmail</h2>
            <p className="text-slate-400 text-sm mt-2 font-medium leading-relaxed max-w-sm mx-auto">
              Hi <span className="text-white font-bold">{userRole?.fullName || 'there'}</span>.
              Starting {formattedDate}, LEC - Alpha requires a verified personal Gmail
              to keep your account secure. Click below to link yours now.
            </p>
          </div>

          {/* How it works */}
          <div className="mb-6 p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2.5">
            {[
              { n: '1', text: 'Click "Link Gmail via Google" below' },
              { n: '2', text: 'Select the Google account you want to link' },
              { n: '3', text: "You'll be brought right back — all done!" },
            ].map(({ n, text }) => (
              <div key={n} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-church-blue-500/20 text-church-blue-400 text-xs font-black flex items-center justify-center shrink-0">
                  {n}
                </span>
                <span className="text-slate-300 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-5 p-4 bg-red-900/50 border-2 border-red-500/50 rounded-2xl text-red-300 text-sm text-center font-semibold flex items-center gap-2 justify-center">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleLinkViaGoogle}
            disabled={loading}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2.5 text-base shadow-md hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={22} />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.63-.69z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            <span>{loading ? 'Redirecting to Google…' : 'Link Gmail via Google'}</span>
          </button>

          <p className="text-center text-slate-600 text-xs mt-4 font-medium">
            Don't have a Gmail? Contact your admin for help.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
