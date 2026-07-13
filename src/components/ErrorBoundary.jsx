import { Component } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { normalizeError } from '../lib/errorUtils';

/**
 * Catches any unhandled React rendering error and shows a friendly recovery
 * screen instead of a white/blank page.
 *
 * Also handles the common "chunk load failed" case that happens when a user
 * has an old tab open after a new deploy — that surfaces as a scary
 * "Failed to fetch dynamically imported module" message, so we detect it and
 * prompt a reload instead.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const rawMsg = String(this.state.error?.message || '');
      const isChunkError =
        /dynamically imported module|chunk|importing a module script failed|Failed to fetch/i.test(rawMsg);

      const { title, message } = normalizeError(this.state.error, {
        fallbackMessage:
          'The app ran into an unexpected error. Please refresh the page. If the problem persists, contact your admin.',
      });

      const heading = isChunkError ? 'Update available' : title;
      const body = isChunkError
        ? 'A new version of the app is ready. Please refresh to continue.'
        : message;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-900 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="text-red-400" size={30} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white mb-2">{heading}</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">{body}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 bg-church-blue-500/10 hover:bg-church-blue-500/20 border border-church-blue-500/30 text-church-blue-400 font-bold rounded-xl transition-all text-sm"
          >
            <RefreshCw size={16} />
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
