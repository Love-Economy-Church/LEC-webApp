import { IonPage, IonContent } from '@ionic/react';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Users, BarChart3, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import AttendanceMarking from '../components/attendance/AttendanceMarking';
import AttendanceAnalytics from '../components/attendance/AttendanceAnalytics';
import UnitScopeSelector from '../components/attendance/UnitScopeSelector';

export default function AttendancePage() {
  const location = useLocation();
  const { user, userRole, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('marking');
  
  useEffect(() => {
      const params = new URLSearchParams(location.search);
      if (params.get('tab') === 'analytics') {
          setActiveTab('analytics');
      } else if (params.get('focus') === 'first_timers') {
          setActiveTab('marking');
          // Wait slightly longer to ensure the sub-components are fully rendered and members loaded
          setTimeout(() => {
              const el = document.getElementById('first-timers-section');
              if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Add a brief highlight flash
                  el.classList.add('ring-2', 'ring-church-blue-500', 'bg-church-blue-500/10', 'transition-all', 'duration-500');
                  setTimeout(() => {
                      el.classList.remove('ring-2', 'ring-church-blue-500', 'bg-church-blue-500/10');
                  }, 1500);
              }
          }, 800);
      }
  }, [location.search]);
  
  // Drill-down scope selected by the user (defaults to their own unit, updated by the selector)
  const [scope, setScope] = useState({ 
    id: userRole?.unitId, 
    type: userRole?.unitType, 
    name: userRole?.unitName 
  });

  // If user is logged in but hasn't been linked to a person/role yet
  if (!userRole) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 p-8">
            <div className="w-20 h-20 rounded-full bg-church-yellow-100 flex items-center justify-center border-4 border-church-yellow-500">
                <AlertCircle className="text-church-yellow-600" size={40} />
            </div>
            <h2 className="text-3xl font-black text-gray-900">Access Pending</h2>
            <p className="text-gray-600 max-w-md font-medium">
                Your account ({user.email}) is authenticated, but not linked to any specific role or unit in the organization yet.
            </p>
            <p className="text-sm text-church-blue-600 uppercase font-bold tracking-wider">
                Please contact an administrator to link your profile.
            </p>
            <button 
                onClick={signOut}
                className="mt-4 px-6 py-3 bg-white hover:bg-gray-50 rounded-xl text-gray-900 font-bold transition-colors border-2 border-gray-300 flex items-center gap-2"
            >
                <LogOut size={20} />
                Sign Out
            </button>
        </div>
    );
  }

  return (
    // <IonPage>
        // <IonContent className="ion-padding-bottom bg-gradient-dark">
            <div className="space-y-4">

      <div className="relative z-10 space-y-5">
      
      {/* Header & User Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-white leading-tight">
            Attendance <span className="text-church-blue-400">Tracking</span>
          </h1>
          <p className="text-gray-400 mt-1 font-medium">
            Welcome, <span className="text-church-blue-400 font-bold">{userRole.fullName}</span>
          </p>
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-4">
            <div className="text-left md:text-right block">
                <div className="text-sm font-black text-white">{userRole.title}</div>
                <div className="text-xs text-church-blue-400 font-bold uppercase tracking-wider">{userRole.unitName}</div>
            </div>
            {userRole.photoUrl && (
                <div className="w-14 h-14 rounded-xl overflow-hidden">
                    <img src={userRole.photoUrl} alt={userRole.fullName} className="w-full h-full object-cover" />
                </div>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div className="relative flex gap-8">
        <button
          onClick={() => setActiveTab('marking')}
          className={`relative flex items-center gap-2.5 pb-4 text-sm font-black transition-colors duration-200 ${
            activeTab === 'marking' 
              ? 'text-church-blue-400' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <CheckCircle2 size={20} />
          Mark Attendance
          {activeTab === 'marking' && (
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-church-blue-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`relative flex items-center gap-2.5 pb-4 text-sm font-black transition-colors duration-200 ${
            activeTab === 'analytics' 
              ? 'text-church-blue-400' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <BarChart3 size={20} />
          Analytics & Reports
          {activeTab === 'analytics' && (
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-church-blue-500 rounded-full" />
          )}
        </button>
        {/* Base line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-700/50" />
      </div>

      {/* Content Area */}
      {/* Hierarchical Scope Selector */}
      <UnitScopeSelector 
          userRole={userRole} 
          onScopeChange={(id, type, name) => setScope({ id, type, name })} 
      />

      {activeTab === 'marking' && (
        <AttendanceMarking 
          currentRole={userRole} 
          overrideUnitId={scope.id} 
          overrideUnitName={scope.name} 
          overrideUnitType={scope.type}
        />
      )}
      {activeTab === 'analytics' && (
        <AttendanceAnalytics 
          currentRole={userRole} 
          overrideUnitId={scope.id} 
          overrideUnitType={scope.type}
          overrideUnitName={scope.name}
        />
      )}
      </div>
    </div>
      // </IonContent>
    // </IonPage>
  );
}
