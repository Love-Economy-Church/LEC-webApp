import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Key, Lock, CheckCircle2, Loader2, X } from 'lucide-react';
import Modal from './ui/Modal';

export default function ChangePasswordModal({ isOpen, onClose }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            setSuccess('Password updated successfully! You can now use this password to sign in.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            
            // Auto close after 2 seconds
            setTimeout(() => {
                setSuccess('');
                onClose();
            }, 2500);

        } catch (err) {
            setError(err.message || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Change Password"
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                
                {error && (
                    <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-xl text-red-300 text-sm font-semibold">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="p-3 bg-teal-900/50 border border-teal-500/50 rounded-xl text-teal-300 text-sm font-semibold flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        {success}
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">New Password</label>
                    <div className="relative group">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-church-blue-400 transition-colors" size={16} />
                        <input
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-church-blue-500/50 focus:ring-2 focus:ring-church-blue-500/50 transition-all text-slate-200 placeholder:text-slate-600"
                            placeholder="Enter new password"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 ml-1">Confirm New Password</label>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-church-blue-400 transition-colors" size={16} />
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-church-blue-500/50 focus:ring-2 focus:ring-church-blue-500/50 transition-all text-slate-200 placeholder:text-slate-600"
                            placeholder="Confirm new password"
                        />
                    </div>
                </div>

                <div className="pt-4 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all border border-slate-700 font-bold flex items-center justify-center gap-2"
                    >
                        <X size={18} />
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || success}
                        className="flex-[2] py-3 rounded-xl bg-gradient-church text-white font-black hover:opacity-90 transition-all shadow-lg border-2 border-church-blue-600 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                        Update Password
                    </button>
                </div>
            </form>
        </Modal>
    );
}
