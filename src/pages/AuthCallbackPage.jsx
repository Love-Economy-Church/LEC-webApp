import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getFriendlyMessage } from '../lib/errorUtils';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Handles two scenarios:
 *
 * 1. Normal Google Sign-In (/auth/callback)
 *    - Supabase resolves the session from the URL hash automatically
 *    - Once user is available, navigate home
 *
 * 2. Gmail Linking (/auth/callback?mode=link)
 *    - User came from EmailGatePage to prove they own a Gmail
 *    - We grab the verified Google email and call link_google_email RPC
 *    - Sign out the transient Google session, redirect to /login with success message
 */
export default function AuthCallbackPage() {
  const { user, loading } = useAuth();
  const navigate          = useNavigate();
  const [searchParams]    = useSearchParams();
  const isLinkMode        = searchParams.get('mode') === 'link';

  const [status,  setStatus]  = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  // ── Normal sign-in (not link mode) ──────────────────────────────────────
  useEffect(() => {
    if (isLinkMode) return; // handled separately below

    if (!loading && user)  navigate('/attendance', { replace: true });
    if (!loading && !user) navigate('/login',      { replace: true });
  }, [user, loading, isLinkMode, navigate]);

  // ── Link-mode: extract Google email and save to profile ─────────────────
  useEffect(() => {
    if (!isLinkMode) return;

    async function handleLinking() {
      try {
        // Wait until Supabase has resolved the Google OAuth session
        // (onAuthStateChange fires and populates `user`)
        // We poll briefly; normally resolves within 1-2 seconds.
        let googleUser = user;
        if (!googleUser) {
          // Wait up to 8 seconds for the session to appear
          for (let i = 0; i < 16; i++) {
            await new Promise(r => setTimeout(r, 500));
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) { googleUser = session.user; break; }
          }
        }

        if (!googleUser) {
          throw new Error('Could not complete Google sign-in. Please try again.');
        }

        const googleEmail = googleUser.email;
        if (!googleEmail) {
          throw new Error('No email returned from Google. Please try again.');
        }

        // Retrieve the original person ID stored before the OAuth redirect
        const personId = sessionStorage.getItem('linking_person_id');
        if (!personId) {
          throw new Error('Session expired during sign-in. Please sign in again and retry.');
        }

        // Call the SECURITY DEFINER RPC — works under the Google session
        const { error: rpcError } = await supabase.rpc('link_google_email', {
          p_person_id: personId,
          p_gmail:     googleEmail,
        });

        if (rpcError) throw rpcError;

        // Clean up
        sessionStorage.removeItem('linking_person_id');
        sessionStorage.removeItem('auth_error');

        // Sign out the transient Google session
        await supabase.auth.signOut();

        // Leave a success message for the Login page to display
        sessionStorage.setItem(
          'link_success',
          `✅ Gmail linked! Your account is now secured with ${googleEmail}. Please sign in.`
        );

        setStatus('success');
        setMessage(`Gmail linked! Redirecting you to sign in…`);

        setTimeout(() => navigate('/login', { replace: true }), 2000);

      } catch (err) {
        console.error('[AuthCallback/link]', err);
        sessionStorage.removeItem('linking_person_id');
        await supabase.auth.signOut().catch(() => {});
        setStatus('error');
        setMessage(getFriendlyMessage(err, 'Something went wrong linking your account. Please try again.'));
        setTimeout(() => navigate('/login', { replace: true }), 4000);
      }
    }

    handleLinking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLinkMode]);

  // ── UI ───────────────────────────────────────────────────────────────────
  if (!isLinkMode) {
    // Normal callback — just show a spinner while we wait
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900">
        <Loader2 className="animate-spin text-church-blue-500" size={40} />
        <p className="text-slate-400 font-semibold text-sm tracking-wide">
          Completing sign-in, please wait…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-slate-900 p-6 text-center">
      {status === 'loading' && (
        <>
          <Loader2 className="animate-spin text-church-blue-500" size={40} />
          <p className="text-slate-400 font-semibold text-sm tracking-wide">
            Linking your Gmail, please wait…
          </p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="text-emerald-400" size={30} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white mb-1">Gmail Linked!</h2>
            <p className="text-slate-400 text-sm">{message}</p>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle className="text-red-400" size={30} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white mb-1">Linking Failed</h2>
            <p className="text-slate-400 text-sm max-w-sm">{message}</p>
            <p className="text-slate-600 text-xs mt-2">Redirecting you to sign in…</p>
          </div>
        </>
      )}
    </div>
  );
}
