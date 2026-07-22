import React, { useRef, useState, useEffect, useCallback } from 'react'
import { NavLink, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { Home, Users, CheckCircle2, User, MessageCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation'
import { useUnreadMessages } from '../../hooks/useUnreadMessages'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import InstallBanner from '../InstallBanner'

const ROUTES = ['/', '/directory', '/attendance', '/chats', '/profile']

export default function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { onSwipeLeft, onSwipeRight, currentIndex } = useSwipeNavigation()
  const mainTouchStart = useRef(null)
  const mainRef = useRef(null)
  const scrollTimeout = useRef(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const { unreadCount } = useUnreadMessages()
  const { userRole } = useAuth()

  // Notification Banner State
  const [notification, setNotification] = useState(null)

  // Global Real-time Chat Notification Listener
  useEffect(() => {
    if (!userRole?.personId) return;

    const channel = supabase
      .channel('global-chat-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'private_messages',
      }, async (payload) => {
        // Only notify if we are the recipient and not currently on the chats page
        if (payload.new?.recipient_id === userRole.personId && location.pathname !== '/chats') {
          try {
            // Fetch sender's name and photo
            const { data } = await supabase
              .from('people')
              .select('full_name, photo_url')
              .eq('id', payload.new.sender_id)
              .single();
              
            const senderName = data?.full_name || 'Someone';
            const photoUrl = data?.photo_url;
            
            // Show custom toast notification
            setNotification({
              sender: senderName,
              photo: photoUrl,
              message: payload.new.message,
              id: payload.new.id
            });
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
              setNotification(prev => prev?.id === payload.new.id ? null : prev);
            }, 5000);
          } catch (e) {
            console.error("Error fetching sender for notification:", e);
          }
        }
      })
      .subscribe((status) => {
        console.log('[NotificationSub] Status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole?.personId, location.pathname]);

  const handleScroll = useCallback(() => {
    setIsScrolling(true)
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
    scrollTimeout.current = setTimeout(() => setIsScrolling(false), 300)
  }, [])

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', handleScroll)
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
    }
  }, [handleScroll])

  return (
    <div className="h-screen w-screen bg-gradient-dark text-gray-100 font-sans selection:bg-church-blue-400/30 flex flex-col overflow-hidden relative">
      {/* Shared Decorative Dot Pattern */}
      <div className="absolute inset-0 bg-dot-pattern bg-dot-md text-church-blue-500 opacity-[0.03] pointer-events-none z-0"></div>
      
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden h-full">
        {/* Desktop Navigation */}
        <nav className="hidden md:block relative z-50 bg-black/60 backdrop-blur-md border-b border-church-blue-500/30 shadow-2xl shrink-0">
          <div className="max-w-[1440px] mx-auto px-0 md:px-2 h-16 flex items-center justify-between">
            {/* Desktop Brand */}
            <div className="flex items-center -ml-2">
              <img src="/lec-shield-logo.png" alt="LEC Shield" className="w-12 h-12 object-contain scale-[1.35] origin-right -mr-1.5" />
              <div className="w-[1px] h-10 bg-white/30 mr-2 z-10"></div>
              <div className="text-left py-1 z-10">
                <p className="text-white font-black text-[11px] md:text-xs tracking-wider uppercase leading-tight mb-0">Love Economy</p>
                <p className="text-white font-black text-[11px] md:text-xs tracking-wider uppercase leading-tight">Church</p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
              <NavItem to="/" icon={<Home size={18} />} label="Home" />
              <NavItem to="/directory" icon={<Users size={18} />} label="Directory" />
              <NavItem to="/attendance" icon={<CheckCircle2 size={18} />} label="Attendance" />
              <NavItem to="/chats" icon={<MessageCircle size={18} />} label="Chats" badge={unreadCount} />
              <NavItem to="/profile" icon={<User size={18} />} label="Profile" />
            </div>
          </div>
        </nav>

        {/* Mobile Header */}
        <header className="md:hidden relative z-50 bg-black/80 backdrop-blur-md border-b border-church-blue-500/20 px-4 h-14 flex items-center justify-between shadow-lg shrink-0 w-full">
          <div className="flex items-center">
            <img src="/lec-shield-logo.png" alt="" className="w-9 h-9 object-contain drop-shadow-lg" />
            <div className="w-px h-6 bg-white/20 mx-2"></div>
            <div className="flex flex-col justify-center">
                <p className="text-white font-black text-[9px] tracking-widest uppercase leading-tight mb-0">Love Economy</p>
                <p className="text-white font-black text-[9px] tracking-widest uppercase leading-tight">Church</p>
            </div>
          </div>
        </header>

        {/* Content Area */}
        {/* /mindmap and /chats both need full-bleed: no padding, no scroll wrapper */}
        <main
          ref={mainRef}
          className={`flex-1 custom-scrollbar touch-pan-y ${
            location.pathname === '/chats' || location.pathname === '/mindmap'
              ? 'overflow-hidden'
              : 'overflow-y-auto'
          }`}
        >
          <div className={
            location.pathname === '/chats' || location.pathname === '/mindmap'
              ? 'h-full'
              : 'px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8'
          }>
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Tabs */}
        <nav className={`md:hidden fixed bottom-0 left-0 z-50 w-full transition-all duration-500 ease-out border-t border-white/5 bg-slate-950/95 backdrop-blur-xl shrink-0 ${
          isScrolling ? 'opacity-20 translate-y-1 pointer-events-auto' : 'opacity-100 pointer-events-auto translate-y-0'
        }`}>
          <div className="px-4 py-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-2xl">
            <TabItem to="/" icon={<Home size={20} />} label="Home" />
            <TabItem to="/directory" icon={<Users size={20} />} label="Directory" />
            <TabItem to="/attendance" icon={<CheckCircle2 size={20} />} label="Attendance" />
            <TabItem to="/chats" icon={<MessageCircle size={20} />} label="Chats" badge={unreadCount} />
            <TabItem to="/profile" icon={<User size={20} />} label="Profile" />
          </div>
        </nav>

        {/* PWA Install Banner */}
        <InstallBanner />

        {/* Global Toast Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -80, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -80, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              onClick={() => {
                setNotification(null)
                navigate('/chats')
              }}
              className="fixed top-16 md:top-20 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[9999] bg-[#0b1329]/95 backdrop-blur-xl border border-church-blue-500/30 p-4 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer hover:border-church-blue-500/60 transition-colors select-none"
              style={{ boxShadow: '0 20px 25px -5px rgba(59, 130, 246, 0.1), 0 10px 10px -5px rgba(59, 130, 246, 0.04)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                {notification.photo ? (
                  <img src={notification.photo} alt={notification.sender} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-church-blue-600 flex items-center justify-center text-white font-bold text-sm uppercase">
                    {notification.sender[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-church-blue-400 flex items-center gap-1">
                  <MessageCircle size={10} />
                  New Private Message
                </p>
                <p className="text-sm font-bold text-white truncate mt-0.5">{notification.sender}</p>
                <p className="text-xs text-slate-300 truncate mt-0.5">"{notification.message}"</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setNotification(null)
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function NavItem({ to, icon, label, badge = 0 }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `
        relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200
        ${isActive
          ? 'bg-gradient-church text-white shadow-lg'
          : 'text-gray-400 hover:text-church-blue-400 hover:bg-white/5'
        }
      `}
    >
      <span className="relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none animate-pulse">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span>{label}</span>
    </NavLink>
  )
}

function TabItem({ to, icon, label, badge = 0 }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `
        flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200 shrink-0 select-none
        ${isActive ? 'text-church-blue-400' : 'text-slate-500 hover:text-slate-400'}
      `}
    >
      {({ isActive }) => (
        <>
          <div className={`relative p-1 rounded-lg transition-all duration-200 ${
            isActive ? 'bg-church-blue-500/10 text-church-blue-400 scale-105' : 'text-slate-500'
          }`}>
            {icon}
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center leading-none">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </div>
          <span className={`text-[8.5px] font-black tracking-wider uppercase transition-colors duration-200 ${
            isActive ? 'text-church-blue-400' : 'text-slate-500'
          }`}>{label}</span>
        </>
      )}
    </NavLink>
  )
}
