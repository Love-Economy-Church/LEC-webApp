import React, { Suspense, lazy } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './components/Login'
import MainLayout from './components/layout/MainLayout'

// Lazy loaded Pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const PeopleDirectoryPage = lazy(() => import('./pages/PeopleDirectoryPage'))
const MemberProfilePage = lazy(() => import('./pages/MemberProfilePage'))
const HierarchyMindMapPage = lazy(() => import('./pages/HierarchyMindMapPage'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const ChatsPage = lazy(() => import('./pages/ChatsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const EmailGatePage = lazy(() => import('./pages/EmailGatePage'))
const AdminPasswordLogPage = lazy(() => import('./pages/AdminPasswordLogPage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900">
    <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-church-blue-500"></div>
  </div>
)

function AppContent() {
  const { needsEmailGate } = useAuth();

  if (needsEmailGate) {
    return (
      <Suspense fallback={<PageLoader />}>
        <EmailGatePage />
      </Suspense>
    );
  }

  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Google OAuth callback — must be a named route inside the Router */}
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Public Main Layout Routes */}
          <Route element={<MainLayout />}>
            {/* Public but inside MainLayout */}
            <Route index element={<DashboardPage />} />
            
            {/* Protected Routes */}
            <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
              <Route path="directory" element={<PeopleDirectoryPage />} />
              <Route path="directory/:personId" element={<MemberProfilePage />} />
              <Route path="mindmap" element={<HierarchyMindMapPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="chats" element={<ChatsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="admin/passwords" element={<AdminPasswordLogPage />} />
            </Route>
          </Route>

          {/* Catch-all route to redirect unknown URLs to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
