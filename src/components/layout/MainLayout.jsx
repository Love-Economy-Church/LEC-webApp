import React, { useRef, useState, useEffect, useCallback } from 'react'
import { NavLink, useLocation, Outlet } from 'react-router-dom'
import { Home, Users, List, CheckCircle2, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation'
import InstallBanner from '../InstallBanner'

const ROUTES = ['/', '/directory', '/attendance', '/profile']

export default function MainLayout() {
  const location = useLocation()
  const { onSwipeLeft, onSwipeRight, currentIndex } = useSwipeNavigation()
  const mainTouchStart = useRef(null)
  const mainRef = useRef(null)
  const scrollTimeout = useRef(null)
  const [isScrolling, setIsScrolling] = useState(false)

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
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto custom-scrollbar touch-pan-y"
        >
          <div className="px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8">
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
            <TabItem to="/profile" icon={<User size={20} />} label="Profile" />
          </div>
        </nav>
        {/* PWA Install Banner */}
        <InstallBanner />
      </div>
    </div>
  )
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200
        ${isActive
          ? 'bg-gradient-church text-white shadow-lg'
          : 'text-gray-400 hover:text-church-blue-400 hover:bg-white/5'
        }
      `}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

function TabItem({ to, icon, label }) {
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
          <div className={`p-1 rounded-lg transition-all duration-200 ${
            isActive ? 'bg-church-blue-500/10 text-church-blue-400 scale-105' : 'text-slate-500'
          }`}>
            {icon}
          </div>
          <span className={`text-[8.5px] font-black tracking-wider uppercase transition-colors duration-200 ${
            isActive ? 'text-church-blue-400' : 'text-slate-500'
          }`}>{label}</span>
        </>
      )}
    </NavLink>
  )
}
