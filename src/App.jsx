import { AuthProvider, useAuth } from './contexts/AuthContext'
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './components/Login'
import MainLayout from './components/layout/MainLayout'

// Pages
import DashboardPage from './pages/DashboardPage'
import PeopleDirectoryPage from './pages/PeopleDirectoryPage'
import MemberProfilePage from './pages/MemberProfilePage'
import HierarchyMindMapPage from './pages/HierarchyMindMapPage'
import AttendancePage from './pages/AttendancePage'
import ChatsPage from './pages/ChatsPage'
import ProfilePage from './pages/ProfilePage'
import EmailGatePage from './pages/EmailGatePage'
import AdminPasswordLogPage from './pages/AdminPasswordLogPage'
import AuthCallbackPage from './pages/AuthCallbackPage'

function AppContent() {
  const { needsEmailGate } = useAuth();

  if (needsEmailGate) {
    return <EmailGatePage />;
  }

  return (
    <Router>
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
      </Routes>
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
