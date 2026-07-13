import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { KeyRound, Search, Eye, EyeOff, Loader2, Calendar, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import ErrorState from '../components/ui/ErrorState';

export default function AdminPasswordLogPage() {
  const { userRole } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState({}); // { logId: boolean }

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.rpc('get_password_change_logs');
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to fetch password change logs:', err);
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleReveal = (logId) => {
    setRevealedPasswords(prev => ({ ...prev, [logId]: true }));
    // Hide after 10 seconds
    setTimeout(() => {
      setRevealedPasswords(prev => ({ ...prev, [logId]: false }));
    }, 10000);
  };

  const handleHide = (logId) => {
    setRevealedPasswords(prev => ({ ...prev, [logId]: false }));
  };

  // Filter logs by search term
  const filteredLogs = logs.filter(log => 
    log.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="animate-spin text-church-blue-500" size={40} />
        <p className="text-slate-400 animate-pulse font-semibold">Loading Password Logs...</p>
      </div>
    );
  }

  // If unauthorized (role check is separate from load failures)
  if (!userRole || userRole.level > 4) {
    return (
      <div className="p-6 bg-red-950/20 border-2 border-red-500/30 rounded-xl text-center max-w-xl mx-auto my-12">
        <ShieldAlert className="mx-auto mb-4 text-red-500" size={48} />
        <h3 className="text-red-400 font-black mb-2 text-xl">Access Denied</h3>
        <p className="text-red-300/80 text-sm font-semibold">
          You do not have administrative permissions to view this resource.
        </p>
      </div>
    );
  }

  // If the logs failed to load (network / server), offer a retry.
  if (loadError) {
    return <ErrorState variant="full" error={loadError} onRetry={loadLogs} retrying={loading} />;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto relative z-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-white/5">
        <div>
          <h2 className="text-3xl font-black bg-gradient-church bg-clip-text text-transparent flex items-center gap-2">
            <KeyRound className="text-church-blue-500 shrink-0" size={32} />
            Password Change Log
          </h2>
          <p className="text-slate-400 text-xs mt-1 font-semibold">
            Track and view plain-text password updates for members (Admin Only)
          </p>
        </div>

        {/* Search */}
        <div className="relative group w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-church-blue-400 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 w-full text-sm focus:outline-none focus:border-church-blue-500 focus:ring-2 focus:ring-church-blue-500/50 transition-all placeholder:text-slate-500 text-slate-200 font-medium"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <KeyRound size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-lg font-medium text-slate-400">No logs found</p>
            <p className="text-sm text-slate-600">No password change events match your criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-black/40 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="p-4 pl-6">Member Name</th>
                  <th className="p-4">Updated Date</th>
                  <th className="p-4">Action Details</th>
                  <th className="p-4 pr-6 text-right">New Password</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-slate-300 font-semibold">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 pl-6">
                      <span className="text-white font-bold block">{log.full_name || 'Unknown User'}</span>
                      <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider mt-0.5">Member</span>
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-500" />
                        {new Date(log.changed_at).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4 text-xs">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-church-blue-500/10 text-church-blue-400 border border-church-blue-500/20">
                        {log.note || 'Changed by self'}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        {revealedPasswords[log.id] ? (
                          <>
                            <span className="font-mono text-emerald-400 font-bold text-base bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 tracking-wider">
                              {log.new_password}
                            </span>
                            <button
                              onClick={() => handleHide(log.id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5"
                              title="Hide password"
                            >
                              <EyeOff size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="font-mono text-slate-500 tracking-widest text-lg">
                              ••••••••
                            </span>
                            <button
                              onClick={() => handleReveal(log.id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5"
                              title="Reveal password (10s)"
                            >
                              <Eye size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
