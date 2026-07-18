import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getFriendlyMessage } from '../lib/errorUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Lock, Mail, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');
  const [authMode, setAuthMode] = useState('password'); // 'password' | 'google'
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || { pathname: '/' };

  const EMAIL_GATE_ACTIVATION_DATE = "2026-06-25";
  const gateDate = new Date(EMAIL_GATE_ACTIVATION_DATE);
  const isGateActive = new Date() >= gateDate;

  useEffect(() => {
    const savedSuccess = sessionStorage.getItem('link_success');
    if (savedSuccess) {
      setLinkSuccess(savedSuccess);
      sessionStorage.removeItem('link_success');
      sessionStorage.removeItem('auth_error');
      setError('');
    } else {
      const savedError = sessionStorage.getItem('auth_error');
      if (savedError) {
        setError(savedError);
        sessionStorage.removeItem('auth_error');
      }
    }
  }, []);

  // Debounced email check to toggle login mode
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    const domain = trimmed.split('@')[1] || '';
    // Personal email providers — these go through the Google/magic-link flow
    const PERSONAL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'me.com', 'live.com', 'protonmail.com'];
    // Any domain that is NOT a known personal provider is treated as an org email (password login)
    const isOrgEmail = domain.length > 0 && !PERSONAL_DOMAINS.includes(domain);
    // Org/generated emails always use password login — skip the Google auth check
    if (!trimmed || !trimmed.includes('@') || trimmed.length < 5 || isOrgEmail) {
      setAuthMode('password');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { data: mode, error } = await supabase.rpc('get_email_auth_mode', { input_email: trimmed });
        if (!error && mode) {
          // 'google'    → verified Gmail linked to a profile
          // 'password'  → fallback (shouldn't normally reach here for personal emails)
          // 'unlinked'  → Gmail typed but not linked to any profile
          setAuthMode(mode);
        } else {
          setAuthMode('unlinked');
        }
      } catch (err) {
        console.error("Error checking auth mode:", err);
        setAuthMode('unlinked');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Resolve email (supports dual sign-in with personal email)
      const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_login_email', { input_email: email });
      
      const emailToUse = (!rpcError && resolvedEmail) ? resolvedEmail : email;

      // 2. Sign in
      let signInResult = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      // Fallback: If sign-in fails and the resolved email was different from the user's typed input,
      // try signing in with the original typed input email directly.
      if (signInResult.error && emailToUse.trim().toLowerCase() !== email.trim().toLowerCase()) {
        signInResult = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
      }

      if (signInResult.error) throw signInResult.error;
      
      // On success, AuthContext will pick it up, we just navigate
      navigate(from, { replace: true });

    } catch (err) {
      console.error('Failed to sign in:', err);
      setError(getFriendlyMessage(err, 'Failed to sign in. Please check your details and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const queryParams = authMode === 'google' && email.trim()
        ? {
            // login_hint pre-fills the email field on the Google sign-in page
            login_hint: email.trim().toLowerCase(),
            // prompt=login forces Google to show the sign-in page for that
            // specific account directly — no account picker, no switching accounts
            prompt: 'login',
          }
        : { prompt: 'select_account' }; // let them pick freely

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams,
        }
      });
      if (error) throw error;
      // OAuth replaces React Router state. Preserve the requested in-app route
      // so the callback can send the member back after Google sign-in.
      sessionStorage.setItem(
        'auth_redirect_to',
        `${from.pathname || '/'}${from.search || ''}${from.hash || ''}`
      );
      // Browser will navigate to Google — loading stays true until redirect
    } catch (err) {
      console.error('Failed to sign in with Google:', err);
      setError(getFriendlyMessage(err, 'Failed to sign in with Google. Please try again.'));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-dark relative overflow-hidden">
      {/* Decorative Dot Pattern */}
      <div className="absolute inset-0 bg-dot-pattern bg-dot-md text-church-blue-500 opacity-[0.03]"></div>
      
      <div className="bg-black/60 backdrop-blur-xl border-2 border-church-blue-500/30 p-8 rounded-3xl w-full max-w-md shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
            <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center mb-4 relative">
                <img
                    src="/lec-shield-logo.png"
                    alt="LEC Logo"
                    className="w-full h-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500 scale-110"
                    onError={(e) => {
                        // Fallback to icon if logo fails to load
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                    }}
                />
                <div className="hidden w-full h-full bg-gradient-church items-center justify-center rounded-3xl">
                    <Lock className="text-white" size={48} />
                </div>
            </div>
            <h2 className="text-3xl font-black text-white">Welcome Back!</h2>
            <p className="text-church-blue-400 font-semibold text-sm mt-1">Love Economy Church · Alpha Branch</p>
        </div>

        {/* Gmail linked success banner */}
        {linkSuccess && (
          <div className="mb-6 p-4 bg-emerald-900/40 border border-emerald-500/30 rounded-2xl text-emerald-300 text-sm text-center font-semibold leading-relaxed flex items-center gap-2 justify-center">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{linkSuccess}</span>
          </div>
        )}

        {/* Pre-gate period soft banner */}
        {!isGateActive && !linkSuccess && (
             <div className="mb-6 p-4 bg-church-blue-500/10 border border-church-blue-500/20 rounded-2xl text-church-blue-300 text-xs text-center font-semibold leading-relaxed">
                  📢 <strong>Security Update:</strong> Starting June 25, a personal email (Gmail) will be required to log in. You can link yours in Profile now!
             </div>
        )}

        {error && (
            <div className="mb-6 p-4 bg-red-900/50 border-2 border-red-500/50 rounded-2xl text-red-300 text-sm text-center font-semibold leading-relaxed">
                {error}
            </div>
        )}

        <AnimatePresence mode="wait">
          {authMode === 'unlinked' ? (
            /* ── Unlinked mode: personal email typed but not linked to any profile ── */
            <motion.div
              key="unlinked-mode"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Email display */}
              <div className="relative">
                <input
                  type="email"
                  id="unlinked-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="peer w-full bg-black/50 border-2 border-gray-700 text-white px-4 pt-6 pb-2 pl-11 rounded-xl focus:outline-none focus:ring-2 focus:ring-church-blue-500/50 focus:border-church-blue-500 transition-all placeholder-transparent font-medium"
                  placeholder="Email Address"
                />
                <label 
                  htmlFor="unlinked-email"
                  className="absolute left-11 top-2 text-[10px] font-bold uppercase text-church-blue-400 tracking-wider transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-church-blue-400 cursor-text pointer-events-none"
                >
                  Email Address
                </label>
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 peer-focus:text-church-blue-400 transition-colors" size={20} />
              </div>

              {/* Not linked message */}
              <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-2xl text-amber-300 text-sm font-semibold leading-relaxed space-y-2">
                <p className="flex items-center gap-2">
                  <span className="text-amber-400 text-base">⚠️</span>
                  <span>This Google account is <strong>not linked</strong> to any LEC Alpha profile.</span>
                </p>
                <p className="text-amber-300/80 text-xs leading-relaxed">
                  Please sign in with your church email (e.g. <strong>@churchone.com</strong> or <strong>@churchtwo.com</strong>) instead, then go to your <strong>Profile</strong> to link your Gmail.
                </p>
              </div>
            </motion.div>
          ) : authMode === 'google' ? (
            /* ── Google-only mode: email is linked to a Google account ── */
            <motion.div
              key="google-mode"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Email display */}
              <div className="relative">
                <input
                  type="email"
                  id="google-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="peer w-full bg-black/50 border-2 border-gray-700 text-white px-4 pt-6 pb-2 pl-11 rounded-xl focus:outline-none focus:ring-2 focus:ring-church-blue-500/50 focus:border-church-blue-500 transition-all placeholder-transparent font-medium"
                  placeholder="Email Address"
                />
                <label 
                  htmlFor="google-email"
                  className="absolute left-11 top-2 text-[10px] font-bold uppercase text-church-blue-400 tracking-wider transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-church-blue-400 cursor-text pointer-events-none"
                >
                  Email Address
                </label>
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 peer-focus:text-church-blue-400 transition-colors" size={20} />
              </div>

              {/* Google-only info banner */}
              <div className="p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-semibold leading-relaxed flex items-start gap-2.5">
                <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                <span>This account uses <strong>Google Sign-In</strong> for security. Click below to continue.</span>
              </div>

              {/* Google Sign-In button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
                className="w-full bg-white hover:bg-gray-100 text-gray-800 font-black py-4 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2.5 text-sm shadow-md hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {googleLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.62-1.07-1.42-1.42-2.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}</span>
              </button>
            </motion.div>
          ) : (
            /* ── Password mode: standard email + password form ── */
            <motion.div
              key="password-mode"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <input
                    type="email"
                    id="password-mode-email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="peer w-full bg-black/50 border-2 border-gray-700 text-white px-4 pt-6 pb-2 pl-11 rounded-xl focus:outline-none focus:ring-2 focus:ring-church-blue-500/50 focus:border-church-blue-500 transition-all placeholder-transparent font-medium"
                    placeholder="yourname@example.com"
                  />
                  <label 
                    htmlFor="password-mode-email"
                    className="absolute left-11 top-2 text-[10px] font-bold uppercase text-church-blue-400 tracking-wider transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-church-blue-400 cursor-text pointer-events-none"
                  >
                    Email Address
                  </label>
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 peer-focus:text-church-blue-400 transition-colors" size={20} />
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password-mode-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="peer w-full bg-black/50 border-2 border-gray-700 text-white px-4 pt-6 pb-2 pl-11 pr-11 rounded-xl focus:outline-none focus:ring-2 focus:ring-church-blue-500/50 focus:border-church-blue-500 transition-all placeholder-transparent font-medium"
                    placeholder="Password"
                  />
                  <label 
                    htmlFor="password-mode-password"
                    className="absolute left-11 top-2 text-[10px] font-bold uppercase text-church-blue-400 tracking-wider transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-church-blue-400 cursor-text pointer-events-none"
                  >
                    Password
                  </label>
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 peer-focus:text-church-blue-400 transition-colors" size={20} />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-church-blue-400 transition-colors focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-church hover:opacity-90 text-white font-black py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 text-lg border-2 border-church-blue-600"
                >
                  {loading ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                  <span>{loading ? 'Signing In...' : 'Sign In'}</span>
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#0b0c10] px-3 text-slate-500 font-black tracking-wider">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
                className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-3.5 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2.5 text-sm shadow-md hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <svg className="w-5 h-5 mr-1 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.62-1.07-1.42-1.42-2.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{googleLoading ? 'Redirecting to Google…' : 'Sign In with Google'}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

