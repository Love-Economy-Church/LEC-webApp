/**
 * Central error normalizer.
 *
 * Turns any thrown value (Supabase errors, fetch/network failures, plain
 * Error objects, strings) into a small, predictable shape that the UI can
 * render safely — so users never see raw messages like
 * "TypeError: Failed to fetch" or a PostgREST stack trace.
 *
 * Usage:
 *   const { title, message, isRetryable, kind } = normalizeError(err);
 *   // or, for a quick one-liner:
 *   setError(getFriendlyMessage(err));
 */

export const ERROR_KINDS = {
  OFFLINE: 'offline',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  AUTH: 'auth',
  PERMISSION: 'permission',
  CONFLICT: 'conflict',
  NOT_FOUND: 'notFound',
  SERVER: 'server',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown',
};

const FRIENDLY = {
  [ERROR_KINDS.OFFLINE]: {
    title: "You're offline",
    message: 'No internet connection. Check your network and try again.',
    isRetryable: true,
  },
  [ERROR_KINDS.NETWORK]: {
    title: 'Connection problem',
    message: "We couldn't reach the server. Check your internet and try again.",
    isRetryable: true,
  },
  [ERROR_KINDS.TIMEOUT]: {
    title: 'This is taking too long',
    message: 'The request timed out, likely due to a slow connection. Please try again.',
    isRetryable: true,
  },
  [ERROR_KINDS.AUTH]: {
    title: 'Sign-in problem',
    message: 'Your email or password is incorrect, or your session has expired. Please sign in again.',
    isRetryable: false,
  },
  [ERROR_KINDS.PERMISSION]: {
    title: 'Not allowed',
    message: "You don't have permission to do that. Contact your admin if you think this is a mistake.",
    isRetryable: false,
  },
  [ERROR_KINDS.CONFLICT]: {
    title: 'Already exists',
    message: 'This record already exists or conflicts with existing data.',
    isRetryable: false,
  },
  [ERROR_KINDS.NOT_FOUND]: {
    title: 'Not found',
    message: "We couldn't find what you were looking for. It may have been moved or removed.",
    isRetryable: false,
  },
  [ERROR_KINDS.SERVER]: {
    title: 'Server error',
    message: 'Something went wrong on our end. Please try again in a moment.',
    isRetryable: true,
  },
  [ERROR_KINDS.VALIDATION]: {
    title: 'Check your details',
    message: 'Some information looks incomplete or invalid. Please review and try again.',
    isRetryable: false,
  },
  [ERROR_KINDS.UNKNOWN]: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again. If it keeps happening, contact your admin.',
    isRetryable: true,
  },
};

// Pull a raw message string out of whatever was thrown, without ever throwing.
function rawMessageOf(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string' && error.message) return error.message;
  if (typeof error.error_description === 'string') return error.error_description;
  if (typeof error.error === 'string') return error.error;
  try {
    return JSON.stringify(error);
  } catch {
    return '';
  }
}

function isOffline() {
  // Only meaningful in browser/Capacitor webview; guarded for safety.
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Classify a thrown value into one of ERROR_KINDS.
 * Order matters: most specific / most actionable checks first.
 */
export function classifyError(error) {
  const msg = rawMessageOf(error).toLowerCase();
  const name = (error && error.name ? String(error.name) : '').toLowerCase();
  // Supabase/PostgREST expose codes on the error object; HTTP status on `.status`.
  const code = error && (error.code ?? error.status ?? error.statusCode);
  const codeStr = code != null ? String(code) : '';

  // 1. Hard offline signal from the platform.
  if (isOffline()) return ERROR_KINDS.OFFLINE;

  // 2. Timeouts / aborted requests.
  if (
    name === 'aborterror' ||
    codeStr === '408' ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('etimedout')
  ) {
    return ERROR_KINDS.TIMEOUT;
  }

  // 3. Network / fetch transport failures (the classic "Failed to fetch").
  if (
    name === 'typeerror' && msg.includes('fetch') ||
    msg.includes('failed to fetch') ||
    msg.includes('network request failed') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('err_network') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('connection') && msg.includes('refused') ||
    msg.includes('unable to resolve host') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused')
  ) {
    return ERROR_KINDS.NETWORK;
  }

  // 4. Auth — invalid credentials, expired/invalid JWT.
  if (
    codeStr === '401' ||
    codeStr === 'pgrst301' ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid claim') ||
    msg.includes('jwt expired') ||
    msg.includes('jwt') && msg.includes('invalid') ||
    msg.includes('token has expired') ||
    msg.includes('not authenticated') ||
    msg.includes('email not confirmed')
  ) {
    return ERROR_KINDS.AUTH;
  }

  // 5. Permission — Postgres RLS / insufficient privilege.
  if (
    codeStr === '403' ||
    codeStr === '42501' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level') ||
    msg.includes('not authorized') ||
    msg.includes('insufficient')
  ) {
    return ERROR_KINDS.PERMISSION;
  }

  // 6. Conflict — unique / foreign-key violations.
  if (
    codeStr === '409' ||
    codeStr === '23505' || // unique_violation
    codeStr === '23503' || // foreign_key_violation
    msg.includes('duplicate key') ||
    msg.includes('already exists') ||
    msg.includes('already registered')
  ) {
    return ERROR_KINDS.CONFLICT;
  }

  // 7. Not found.
  if (
    codeStr === '404' ||
    codeStr === 'pgrst116' || // no rows returned for single()
    msg.includes('not found') ||
    msg.includes('no rows')
  ) {
    return ERROR_KINDS.NOT_FOUND;
  }

  // 8. Validation.
  if (
    codeStr === '422' ||
    codeStr === '400' ||
    codeStr === '23502' || // not_null_violation
    codeStr === '23514' || // check_violation
    msg.includes('is required') ||
    msg.includes('invalid input') ||
    msg.includes('violates check constraint') ||
    msg.includes('violates not-null')
  ) {
    return ERROR_KINDS.VALIDATION;
  }

  // 9. Server errors.
  if (/^5\d\d$/.test(codeStr) || msg.includes('internal server error')) {
    return ERROR_KINDS.SERVER;
  }

  return ERROR_KINDS.UNKNOWN;
}

/**
 * Full normalization. Returns a stable object safe to render.
 * The original error is preserved on `.raw` for logging only.
 *
 * @param {*} error       - anything that was thrown/rejected
 * @param {object} [opts]
 * @param {string} [opts.fallbackMessage] - override the generic copy for the
 *        UNKNOWN kind (e.g. a context-specific "Failed to load directory.")
 */
export function normalizeError(error, opts = {}) {
  const kind = classifyError(error);
  const base = FRIENDLY[kind] || FRIENDLY[ERROR_KINDS.UNKNOWN];

  const message =
    kind === ERROR_KINDS.UNKNOWN && opts.fallbackMessage
      ? opts.fallbackMessage
      : base.message;

  return {
    kind,
    title: base.title,
    message,
    isRetryable: base.isRetryable,
    raw: error,
    rawMessage: rawMessageOf(error),
  };
}

/**
 * Convenience one-liner for the many `setError(err.message)` /
 * `Alert.alert('Failed', err.message)` call sites. Returns just the
 * user-facing message string.
 */
export function getFriendlyMessage(error, fallbackMessage) {
  return normalizeError(error, { fallbackMessage }).message;
}
