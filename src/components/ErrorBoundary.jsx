import { Component } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * Catches any unhandled React rendering errors and shows a friendly
 * recovery screen instead of a white/blank page.
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
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-900 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="text-red-400" size={30} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white mb-2">Something went wrong</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
              The app ran into an unexpected error. Please refresh the page. If the problem persists, contact your admin.
            </p>
          </div>
          {this.state.error && (
            <p className="text-xs text-slate-600 font-mono max-w-sm">
              {this.state.error.message}
            </p>
          )}
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
