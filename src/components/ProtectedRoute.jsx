import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <Loader2 className="animate-spin text-emerald-500" size={40} />
        </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children || <Outlet />;
}
