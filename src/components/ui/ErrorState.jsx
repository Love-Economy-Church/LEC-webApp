import { AlertTriangle, Lock, RefreshCw, WifiOff } from 'lucide-react';
import { ERROR_KINDS, normalizeError } from '../../lib/errorUtils';

function KindIcon({ kind, ...props }) {
  if (kind === ERROR_KINDS.OFFLINE || kind === ERROR_KINDS.NETWORK || kind === ERROR_KINDS.TIMEOUT) {
    return <WifiOff {...props} />;
  }
  if (kind === ERROR_KINDS.PERMISSION || kind === ERROR_KINDS.AUTH) {
    return <Lock {...props} />;
  }
  return <AlertTriangle {...props} />;
}

/**
 * Inline / block error card for data-load and section failures.
 *
 * Backward compatible: `<ErrorState message="..." />` works.
 * Preferred: pass the raw `error` and an `onRetry` handler so the card can
 * classify it (icon + title) and show a Try again button when appropriate.
 *
 * Props:
 *   - error?: raw thrown value (preferred — gets classified)
 *   - message?: explicit message string (used if `error` not provided)
 *   - title?: override the title
 *   - onRetry?: () => void — shows a "Try again" button
 *   - retrying?: boolean — shows a spinner on the retry button
 *   - variant?: 'card' (default) | 'full' — 'full' centers in a tall area
 *   - className?: extra classes on the wrapper
 */
export default function ErrorState({
  error,
  message,
  title,
  onRetry,
  retrying = false,
  variant = 'card',
  className = '',
}) {
  const normalized = error !== undefined ? normalizeError(error) : null;
  const kind = normalized?.kind ?? ERROR_KINDS.UNKNOWN;
  const resolvedTitle = title ?? normalized?.title ?? 'Something went wrong';
  const resolvedMessage = message ?? normalized?.message ?? 'Please try again.';
  const showRetry = typeof onRetry === 'function' && (normalized ? normalized.isRetryable : true);

  const card = (
    <div
      className={`w-full max-w-md rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-6 text-center flex flex-col items-center gap-4 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <KindIcon kind={kind} className="text-red-400" size={22} />
      </div>
      <div>
        <h3 className="text-white font-black text-base mb-1">{resolvedTitle}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{resolvedMessage}</p>
      </div>
      {showRetry && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="flex items-center gap-2 px-5 py-2.5 bg-church-blue-500/10 hover:bg-church-blue-500/20 border border-church-blue-500/30 text-church-blue-400 font-bold rounded-xl transition-all text-sm disabled:opacity-60"
        >
          <RefreshCw size={15} className={retrying ? 'animate-spin' : ''} />
          {retrying ? 'Retrying...' : 'Try again'}
        </button>
      )}
    </div>
  );

  if (variant === 'full') {
    return <div className="flex justify-center items-center py-20 px-4">{card}</div>;
  }

  return card;
}
