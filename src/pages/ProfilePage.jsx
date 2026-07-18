import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
    LogOut, UserCircle2, Check, AlertCircle, Loader2, Pencil 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getFriendlyMessage } from '../lib/errorUtils';

function computeAge(dobString) {
  if (!dobString) return null;
  const today = new Date();
  const birth = new Date(dobString);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function ProfilePage() {
  const { user, userRole, signOut, refreshUserRole } = useAuth();

  // Personal Info Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [socialHandle, setSocialHandle] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState('');

  // Password State
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Google Link State
  const [gmailLinkLoading, setGmailLinkLoading] = useState(false);
  const [gmailLinkError, setGmailLinkError] = useState('');

  // File Upload Reference
  const fileInputRef = useRef(null);

  // Initialize fields
  useEffect(() => {
    if (userRole) {
      setFullName(userRole.fullName || '');
      setPhone(userRole.phone || '');
      setDob(userRole.dob || '');
      setSocialHandle(userRole.socialHandle || '');
      setPhotoUrl(userRole.photoUrl || '');
    }
  }, [userRole]);

  // Save profile edits
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setUpdateError('');
    setUpdateSuccess('');
    setUpdateLoading(true);

    try {
      const { error: dbError } = await supabase
        .from('people')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          dob: dob || null,
          social_handle: socialHandle.trim() || null,
          photo_url: photoUrl || null
        })
        .eq('id', userRole.personId);

      if (dbError) throw dbError;

      setUpdateSuccess('Profile details successfully updated!');
      setIsEditing(false);
      
      await refreshUserRole();
    } catch (err) {
      console.error('Failed to update profile:', err);
      setUpdateError(getFriendlyMessage(err, 'Failed to update profile. Please try again.'));
    } finally {
      setUpdateLoading(false);
    }
  };

  // Handle image upload from file picker
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        setUpdateError("Image is too large. Please select a photo under 1.5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result); // Base64 Data URL
      };
      reader.readAsDataURL(file);
    }
  };

  // Password handler
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;

      // Log change
      await supabase.functions.invoke('log-password-change', {
        body: {
          person_id: userRole?.personId || null,
          auth_user_id: user.id,
          full_name: userRole?.fullName || null,
          new_password: newPassword,
          note: 'Password updated by member'
        }
      });

      setPasswordSuccess('Password successfully updated!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (err) {
      console.error('Failed to update password:', err);
      setPasswordError(getFriendlyMessage(err, 'Failed to update password. Please try again.'));
    } finally {
      setPasswordLoading(false);
    }
  };

  // Google Link OAuth flow
  const handleLinkViaGoogle = async () => {
    if (!userRole?.personId) {
      setGmailLinkError('Could not identify your account. Please sign out and try again.');
      return;
    }
    setGmailLinkLoading(true);
    setGmailLinkError('');
    sessionStorage.setItem('linking_person_id', userRole.personId);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?mode=link`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
    } catch (err) {
      setGmailLinkError(getFriendlyMessage(err, 'Failed to start Google sign-in. Please try again.'));
      setGmailLinkLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-[#020617] min-h-[calc(100vh-4rem)] text-gray-100 px-4 pt-4 pb-8 md:px-8 space-y-6 relative">
      <div className="relative z-10 max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="border-b border-white/5 pb-2">
          <h1 className="text-xl font-black text-white leading-tight tracking-tight">
            My <span className="text-church-blue-400">Profile</span>
          </h1>
        </div>

        <div className="space-y-6">
          {/* Profile Header (Minimalistic) */}
          <div className="flex flex-col items-center py-6">
            <div className="relative mb-3 shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center shadow-lg">
                {photoUrl ? (
                  <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle2 size={44} className="text-slate-600" strokeWidth={1} />
                )}
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-church-blue-600 hover:bg-church-blue-500 text-white rounded-lg shadow border border-white/15 flex items-center justify-center transition-transform active:scale-90"
                  title="Upload Photo"
                >
                  <Pencil size={11} />
                </button>
              )}
            </div>

            <h2 className="text-lg font-black text-white text-center">{fullName || 'Anonymous User'}</h2>
            <p className="text-church-blue-400 font-black uppercase tracking-widest text-[9px] mt-0.5">{userRole?.title || 'No Title'}</p>

            {/* Hidden File Input */}
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
          </div>

          {/* View/Edit Section (Minimalistic) */}
          <div className="space-y-1">
            {updateError && (
              <div className="p-3 bg-red-900/50 border border-red-500/30 rounded-xl text-red-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{updateError}</span>
              </div>
            )}
            {updateSuccess && (
              <div className="p-3 bg-emerald-900/50 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Check size={14} className="shrink-0" />
                <span>{updateSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-1">
              <div className="flex justify-between items-center py-2 border-b border-white/[0.05] mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account Details</span>
                {!isEditing ? (
                  <button 
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-[10px] font-black text-church-blue-400 hover:text-church-blue-300 uppercase tracking-wider"
                  >
                    Edit Details
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setFullName(userRole.fullName || '');
                      setPhone(userRole.phone || '');
                      setDob(userRole.dob || '');
                      setSocialHandle(userRole.socialHandle || '');
                      setPhotoUrl(userRole.photoUrl || '');
                    }}
                    className="text-[10px] font-black text-slate-500 hover:text-slate-400 uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Name Row */}
              <div className="py-3 border-b border-white/[0.04]">
                <label className="block text-[9px] font-black uppercase text-slate-500 tracking-wider mb-1">Full Name</label>
                {!isEditing ? (
                  <div className="text-sm font-semibold text-slate-200">{fullName || '—'}</div>
                ) : (
                  <input 
                    type="text" 
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-church-blue-500/40 transition-colors font-semibold"
                  />
                )}
              </div>

              {/* Telephone Row */}
              <div className="py-3 border-b border-white/[0.04]">
                <label className="block text-[9px] font-black uppercase text-slate-500 tracking-wider mb-1">Telephone</label>
                {!isEditing ? (
                  <div className="text-sm font-semibold text-slate-200">{phone || '—'}</div>
                ) : (
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-church-blue-500/40 transition-colors font-semibold"
                    placeholder="+233..."
                  />
                )}
              </div>

              {/* DOB Row */}
              <div className="py-3 border-b border-white/[0.04]">
                <label className="block text-[9px] font-black uppercase text-slate-500 tracking-wider mb-1">Date of Birth</label>
                {!isEditing ? (
                  <div className="text-sm font-semibold text-slate-200 flex justify-between items-center">
                    <span>{dob ? new Date(dob).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</span>
                    {computeAge(dob) != null && (
                      <span className="text-[9px] font-black text-church-blue-400 bg-church-blue-500/10 px-2 py-0.5 rounded-lg border border-church-blue-500/20">{computeAge(dob)} yrs</span>
                    )}
                  </div>
                ) : (
                  <input 
                    type="date" 
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-church-blue-500/40 transition-colors font-semibold"
                  />
                )}
              </div>

              {/* Social Row */}
              <div className="py-3 border-b border-white/[0.04]">
                <label className="block text-[9px] font-black uppercase text-slate-500 tracking-wider mb-1">Social Handle</label>
                {!isEditing ? (
                  <div className="text-sm font-semibold text-slate-200">{socialHandle ? `@${socialHandle.replace('@', '')}` : '—'}</div>
                ) : (
                  <input 
                    type="text" 
                    value={socialHandle}
                    onChange={(e) => setSocialHandle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-church-blue-500/40 transition-colors font-semibold"
                    placeholder="username"
                  />
                )}
              </div>

              {isEditing && (
                <div className="flex justify-end pt-3">
                  <button 
                    type="submit"
                    disabled={updateLoading}
                    className="px-5 py-2 bg-church-blue-600 hover:bg-church-blue-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow"
                  >
                    {updateLoading && <Loader2 className="animate-spin" size={13} />}
                    Save Changes
                  </button>
                </div>
              )}
            </form>

            {/* System Settings Row */}
            <div className="pt-6 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block pb-2 border-b border-white/[0.05]">System Placement</span>

              <div className="flex justify-between items-center py-3 border-b border-white/[0.04]">
                <span className="text-xs font-bold text-slate-400">Church Email</span>
                <span className="text-sm font-semibold text-slate-200 truncate max-w-[200px]">{userRole?.churchoneEmail || user.email}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-white/[0.04]">
                <span className="text-xs font-bold text-slate-400">Assigned Unit</span>
                <span className="text-sm font-semibold text-slate-200 truncate max-w-[200px]">{userRole?.unitName || 'Not Assigned'}</span>
              </div>

              {/* Personal Email Section */}
              <div className="py-3 border-b border-white/[0.04] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400">Personal Email</span>
                  <span className="text-sm font-semibold text-slate-200 truncate max-w-[200px]">
                    {userRole?.personalEmail || 'Not Linked'}
                  </span>
                </div>
                {!userRole?.personalEmail && (
                  <div className="bg-slate-900 border border-white/5 rounded-xl p-3 mt-1 flex flex-col gap-2">
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                      📢 Link your Google account below to enable single sign-on verification.
                    </p>
                    <button
                      onClick={handleLinkViaGoogle}
                      disabled={gmailLinkLoading}
                      className="w-full bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase py-2 rounded-lg border border-white/10 transition-colors flex items-center justify-center gap-2"
                    >
                      {gmailLinkLoading ? <Loader2 className="animate-spin" size={13} /> : null}
                      Link Google Account
                    </button>
                  </div>
                )}
              </div>

              {/* Password Section */}
              <div className="py-3 border-b border-white/[0.04] space-y-3">
                {!showPasswordForm ? (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">Password</span>
                    <button 
                      onClick={() => setShowPasswordForm(true)}
                      className="text-[10px] font-black text-amber-500 hover:underline uppercase tracking-wider"
                    >
                      Change Password
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordChange} className="space-y-3 pt-1 animate-fade-in">
                    {passwordError && (
                      <div className="p-3 bg-red-900/50 border border-red-500/30 rounded-xl text-red-300 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{passwordError}</span>
                      </div>
                    )}
                    {passwordSuccess && (
                      <div className="p-3 bg-emerald-900/50 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                        <Check size={14} className="shrink-0" />
                        <span>{passwordSuccess}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-amber-500 transition-colors font-medium"
                        placeholder="New Password"
                      />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-white px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-amber-500 transition-colors font-medium"
                        placeholder="Confirm Password"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPasswordForm(false)}
                        className="px-3 py-1 text-slate-400 hover:text-white text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="px-3 py-1 bg-amber-500 text-slate-900 rounded-lg text-xs font-bold transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Log out */}
            <div className="pt-6">
              <button 
                onClick={signOut}
                className="w-full bg-red-500/10 hover:bg-red-500/15 text-red-400 border border-red-500/25 rounded-2xl py-3 flex items-center justify-center gap-2 transition-all active:scale-[0.99] font-black text-xs uppercase tracking-wider"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
