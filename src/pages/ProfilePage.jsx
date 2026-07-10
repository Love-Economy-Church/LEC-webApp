import { useState, useEffect, useRef, useMemo } from 'react';

// ─── helpers ──────────────────────────────────────────────────────────────────
function computeAge(dobString) {
  if (!dobString) return null;
  const today = new Date();
  const birth = new Date(dobString);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
import { useAuth } from '../contexts/AuthContext';
import { 
    User, Mail, Lock, Shield, LogOut, ChevronRight, UserCircle2, KeyRound, Check, 
    AlertCircle, Loader2, Phone, Calendar, Globe, MessageSquare, Send, Plus, Upload, Palette, X, Pencil, UserRound, MessageCircle, Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

const PRESETS = [
  { id: 'grad-1', name: 'Cosmic Violet', gradient: 'from-violet-600 via-fuchsia-600 to-pink-600', colors: ['#7c3aed', '#c084fc'] },
  { id: 'grad-2', name: 'Ocean Wave', gradient: 'from-cyan-500 via-blue-500 to-indigo-600', colors: ['#06b6d4', '#4f46e5'] },
  { id: 'grad-3', name: 'Emerald Mint', gradient: 'from-emerald-500 via-teal-500 to-cyan-600', colors: ['#10b981', '#0891b2'] },
  { id: 'grad-4', name: 'Sunset Glow', gradient: 'from-orange-500 via-red-500 to-rose-600', colors: ['#f97316', '#e11d48'] },
  { id: 'grad-5', name: 'Royal Gold', gradient: 'from-yellow-500 via-amber-500 to-orange-600', colors: ['#eab308', '#ea580c'] },
  { id: 'grad-6', name: 'Neon Pink', gradient: 'from-pink-500 via-purple-500 to-indigo-600', colors: ['#ec4899', '#4f46e5'] }
];

export default function ProfilePage() {
  const { user, userRole, signOut, refreshUserRole } = useAuth();

  // Tabs
  const [profileTab, setProfileTab] = useState('info'); // 'info' or 'messages'

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

  // Active Chats State
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [showNewChatList, setShowNewChatList] = useState(false);
  const [leaders, setLeaders] = useState([]);

  // File Upload Reference
  const fileInputRef = useRef(null);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const chatEndRef = useRef(null);

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

  // Load Direct Messages
  useEffect(() => {
    if (profileTab === 'messages' && userRole?.personId) {
      fetchActiveChats();
    }
  }, [profileTab, userRole]);

  // Scroll message thread to bottom
  useEffect(() => {
    if (selectedChatUser && chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, selectedChatUser]);

  // Real-time Chat Listener for Personal Profile Page
  useEffect(() => {
    if (!userRole?.personId || !selectedChatUser) return;

    const channel = supabase
        .channel(`profile-chat-${selectedChatUser.id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'private_messages' 
        }, (payload) => {
            const newMsg = payload.new;
            if (
                (newMsg.sender_id === userRole.personId && newMsg.recipient_id === selectedChatUser.id) ||
                (newMsg.sender_id === selectedChatUser.id && newMsg.recipient_id === userRole.personId)
            ) {
                setChatMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });
            }
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [selectedChatUser, userRole]);

  // Fetch active chats list
  const fetchActiveChats = async () => {
    if (!userRole?.personId) return;
    setChatsLoading(true);
    try {
        const { data, error } = await supabase
            .from('private_messages')
            .select('id, message, created_at, sender_id, recipient_id')
            .or(`sender_id.eq.${userRole.personId},recipient_id.eq.${userRole.personId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Collect all unique participant IDs
        const otherIds = Array.from(new Set(data.map(m => m.sender_id === userRole.personId ? m.recipient_id : m.sender_id)));
        
        if (otherIds.length === 0) {
            setChats([]);
            return;
        }

        // Fetch user profiles for all other participants
        const { data: peopleData, error: peopleError } = await supabase
            .from('people')
            .select(`
                id, 
                full_name, 
                photo_url,
                assignments:position_assignments(
                    position:positions(title)
                )
            `)
            .in('id', otherIds);

        if (peopleError) throw peopleError;

        // Group chats
        const chatsMap = new Map();
        data.forEach(msg => {
            const otherId = msg.sender_id === userRole.personId ? msg.recipient_id : msg.sender_id;
            const otherPerson = peopleData.find(p => p.id === otherId);
            if (!otherPerson) return;

            const role = otherPerson.assignments?.find(a => a.position)?.position?.title || 'Leader';

            if (!chatsMap.has(otherId)) {
                chatsMap.set(otherId, {
                    user: {
                        id: otherPerson.id,
                        name: otherPerson.full_name,
                        photo: otherPerson.photo_url,
                        role
                    },
                    latestMessage: msg.message,
                    time: new Date(msg.created_at)
                });
            }
        });

        setChats(Array.from(chatsMap.values()));
    } catch (err) {
        console.error("Error loading chats:", err);
    } finally {
        setChatsLoading(false);
    }
  };

  // Open conversation
  const handleOpenChat = async (otherUser) => {
    setSelectedChatUser(otherUser);
    setChatsLoading(true);
    try {
        const { data, error } = await supabase
            .from('private_messages')
            .select('*')
            .or(`and(sender_id.eq.${userRole.personId},recipient_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},recipient_id.eq.${userRole.personId})`)
            .order('created_at', { ascending: true });

        if (error) throw error;
        setChatMessages(data || []);
    } catch (err) {
        console.error("Error opening chat:", err);
    } finally {
        setChatsLoading(false);
    }
  };

  // Send message from profile direct messages inbox
  const handleSendProfileMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !userRole || !selectedChatUser) return;

    const messageText = chatInput.trim();
    setChatInput('');
    setSendingMsg(true);

    try {
        const { data, error } = await supabase
            .from('private_messages')
            .insert([{
                sender_id: userRole.personId,
                recipient_id: selectedChatUser.id,
                message: messageText
            }])
            .select()
            .single();

        if (error) throw error;
        setChatMessages(prev => [...prev, data]);
    } catch (err) {
        console.error("Error sending DM:", err);
    } finally {
        setSendingMsg(false);
    }
  };

  // Open "New Chat" modal and fetch leaders
  const handleOpenNewChat = async () => {
    setShowNewChatList(true);
    try {
        const { data, error } = await supabase
            .from('people')
            .select(`
                id,
                full_name,
                photo_url,
                assignments:position_assignments(
                    position:positions(title, level)
                )
            `)
            .eq('is_active', true)
            .eq('is_placeholder', false);

        if (error) throw error;

        // Filter out ourselves, and filter to positions with level <= 5 (leaders)
        const leadersList = (data || [])
            .filter(p => {
                if (p.id === userRole.personId) return false;
                const activeAssign = p.assignments?.find(a => a.position);
                return activeAssign && activeAssign.position.level <= 5;
            })
            .map(p => {
                const activeAssign = p.assignments.find(a => a.position);
                return {
                    id: p.id,
                    name: p.full_name,
                    photo: p.photo_url,
                    role: activeAssign.position.title
                };
            });

        setLeaders(leadersList);
    } catch (err) {
        console.error("Error fetching leaders:", err);
    }
  };

  // Save profile edits
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setUpdateError('');
    setUpdateSuccess('');
    setUpdateLoading(true);

    try {
      // 1. Update Core Bio details in database
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
      
      // 2. Sync changes globally
      await refreshUserRole();
    } catch (err) {
      setUpdateError(err.message || 'Failed to update profile.');
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

  // Select Preset Avatar
  const handleSelectPreset = (preset) => {
    const initials = (fullName || 'U').split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
        <defs>
          <linearGradient id="grad-${preset.id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${preset.colors[0]}" />
            <stop offset="100%" stop-color="${preset.colors[1]}" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r="64" fill="url(#grad-${preset.id})" />
        <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="44" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text>
      </svg>
    `.trim();
    const base64Svg = `data:image/svg+xml;base64,${btoa(svg)}`;
    setPhotoUrl(base64Svg);
    setShowPresetPicker(false);
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
      setPasswordError(err.message || 'Failed to update password.');
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
      setGmailLinkError(err.message || 'Failed to start Google sign-in. Please try again.');
      setGmailLinkLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-[#020617] min-h-[calc(100vh-4rem)] text-gray-100 px-4 pt-4 pb-8 md:px-8 space-y-6 relative">
      <div className="relative z-10 max-w-2xl mx-auto space-y-6">
        
        {/* Header Tabs */}
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <h1 className="text-xl font-black text-white leading-tight tracking-tight">
            My <span className="text-church-blue-400">Profile</span>
          </h1>
          <div className="flex gap-4">
            <button 
              onClick={() => setProfileTab('info')}
              className={`flex items-center gap-1.5 pb-2 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${profileTab === 'info' ? 'text-church-blue-400' : 'text-slate-500 hover:text-slate-350'}`}
            >
              <UserRound size={13} />
              Details
              {profileTab === 'info' && (
                <motion.div 
                  layoutId="profile-tab-line" 
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-church-blue-500 rounded-full" 
                />
              )}
            </button>
            <button 
              onClick={() => setProfileTab('messages')}
              className={`flex items-center gap-1.5 pb-2 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${profileTab === 'messages' ? 'text-church-blue-400' : 'text-slate-500 hover:text-slate-350'}`}
            >
              <MessageCircle size={13} />
              Direct Chat
              {profileTab === 'messages' && (
                <motion.div 
                  layoutId="profile-tab-line" 
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-church-blue-500 rounded-full" 
                />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {profileTab === 'info' ? (
            <motion.div 
              key="info-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-6 animate-fade-in"
            >
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
                          📢 Starting June 25, a verified Gmail is required. Link your Google account below to authenticate.
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
                          className="text-[10px] font-black text-amber-505 hover:underline uppercase tracking-wider"
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
            </motion.div>
          ) : (
            // Messages / Inbox Tab (Minimalistic)
            <motion.div 
              key="messages-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {!selectedChatUser ? (
                // Chats List
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Conversations</span>
                    <button 
                      onClick={handleOpenNewChat}
                      className="px-3.5 py-1.5 bg-church-blue-600 hover:bg-church-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow"
                    >
                      <Plus size={14} />
                      New Chat
                    </button>
                  </div>

                  {chatsLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2">
                      <Loader2 className="animate-spin text-church-blue-500" size={20} />
                      <span className="text-xs text-slate-550 font-bold">Loading inbox...</span>
                    </div>
                  ) : chats.length === 0 ? (
                    <div className="border border-white/5 bg-slate-900/10 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center gap-2">
                      <MessageSquare size={28} className="text-slate-700" strokeWidth={1.5} />
                      <h4 className="font-bold text-slate-400 text-sm">No Messages</h4>
                      <p className="text-xs text-slate-600 max-w-xs">Start a private chat with your leaders to talk directly.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {chats.map(chat => (
                        <div 
                          key={chat.user.id}
                          onClick={() => handleOpenChat(chat.user)}
                          className="flex justify-between items-center py-3 border-b border-white/[0.04] cursor-pointer transition-all hover:bg-white/[0.01] px-1 rounded-lg"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center border border-white/10 shrink-0">
                              {chat.user.photo ? (
                                <img src={chat.user.photo} alt={chat.user.name} className="w-full h-full object-cover" />
                              ) : (
                                <UserCircle2 size={20} className="text-slate-600" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between items-baseline">
                                <span className="font-bold text-slate-200 text-sm truncate leading-snug">{chat.user.name}</span>
                                <span className="text-[8px] text-slate-500 font-bold ml-2">
                                  {chat.time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[9px] text-church-blue-400 font-black uppercase tracking-wider leading-none mt-0.5">{chat.user.role}</p>
                              <p className="text-slate-400 text-xs truncate mt-1 leading-tight">{chat.latestMessage}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Full Screen New Chat Modal */}
                  <AnimatePresence>
                    {showNewChatList && (
                      <div className="fixed inset-0 z-50 bg-[#020617] flex flex-col animate-slide-in">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 shrink-0 bg-slate-950/40">
                          <h3 className="font-black text-white uppercase tracking-wider text-xs">Direct Chat with Leader</h3>
                          <button 
                            onClick={() => setShowNewChatList(false)} 
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-2">
                          {leaders.length === 0 ? (
                            <div className="flex justify-center py-16">
                              <Loader2 className="animate-spin text-church-blue-500" size={24} />
                            </div>
                          ) : (
                            leaders.map(l => (
                              <div 
                                key={l.id}
                                onClick={() => {
                                  setShowNewChatList(false);
                                  handleOpenChat(l);
                                }}
                                className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/40 hover:bg-slate-900/80 border border-white/[0.04] cursor-pointer transition-colors"
                              >
                                <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                                  {l.photo ? (
                                    <img src={l.photo} alt={l.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <User size={18} className="text-slate-650" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-200 text-sm truncate leading-snug">{l.name}</p>
                                  <p className="text-[9px] text-church-blue-400 font-black uppercase tracking-wider leading-none mt-0.5">{l.role}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                // Chat Conversation Thread View (Minimalistic)
                <div className="flex flex-col h-[calc(100vh-14rem)] bg-transparent min-h-0">
                  {/* Thread Header */}
                  <div className="flex justify-between items-center border-b border-white/5 pb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center border border-white/10 shrink-0">
                        {selectedChatUser.photo ? (
                          <img src={selectedChatUser.photo} alt={selectedChatUser.name} className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle2 size={16} className="text-slate-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200 text-sm leading-snug">{selectedChatUser.name}</h4>
                        <p className="text-[8px] text-church-blue-400 font-black uppercase tracking-wider leading-none mt-0.5">{selectedChatUser.role}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedChatUser(null);
                        fetchActiveChats();
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-white"
                    >
                      Back to Inbox
                    </button>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-0.5 custom-scrollbar min-h-0 py-4">
                    {chatMessages.map((msg, index) => {
                      const isMe = msg.sender_id === userRole?.personId;
                      return (
                        <div 
                          key={msg.id || index}
                          className={`flex flex-col max-w-[78%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                        >
                          <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-church-blue-600 text-white rounded-br-sm' : 'bg-slate-800/80 text-slate-100 rounded-bl-sm border border-white/5'}`}>
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                          </div>
                          <span className="text-[8px] text-slate-700 mt-0.5 px-1">
                            {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef}></div>
                  </div>

                  {/* Message Input Form */}
                  <form onSubmit={handleSendProfileMessage} className="pt-3 flex gap-2 shrink-0 bg-transparent">
                    <input 
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a private message..."
                      disabled={sendingMsg}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-church-blue-500/40 transition-colors text-slate-200 placeholder:text-slate-650"
                    />
                    <button 
                      type="submit"
                      disabled={sendingMsg || !chatInput.trim()}
                      className="w-10 h-10 rounded-xl bg-church-blue-600 hover:bg-church-blue-500 disabled:opacity-50 text-white flex items-center justify-center shadow transition-colors active:scale-95 shrink-0"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
