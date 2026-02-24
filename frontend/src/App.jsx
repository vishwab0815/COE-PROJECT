import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Camera, Users, ClipboardList, BarChart3, UserPlus, LogOut, Scan } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import KioskPage from './pages/KioskPage';
import Dashboard from './pages/Dashboard';
import CameraPage from './pages/CameraPage';
import RegisterPage from './pages/RegisterPage';
import StudentsPage from './pages/StudentsPage';
import AttendancePage from './pages/AttendancePage';
import AnalyticsPage from './pages/AnalyticsPage';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/camera', icon: Camera, label: 'Mark Attendance' },
  { to: '/register', icon: UserPlus, label: 'Register Student' },
  { to: '/students', icon: Users, label: 'Students' },
  { to: '/attendance', icon: ClipboardList, label: 'Attendance Logs' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
];

function AdminLayout() {
  const { logout } = useAuth();

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2z" fill="none" />
              <circle cx="12" cy="10" r="3" fill="white" stroke="none" />
              <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h1>Attend-AI</h1>
            <span>Face Recognition System</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon />
              {label}
            </NavLink>
          ))}

          <div style={{ flex: 1 }} />

          <NavLink to="/kiosk" className="nav-link" style={{ color: 'var(--accent-primary)', opacity: 0.7 }}>
            <Scan /> Kiosk Mode
          </NavLink>

          <button onClick={logout} className="nav-link" style={{ color: 'var(--accent-red)', opacity: 0.7 }}>
            <LogOut /> Logout
          </button>
        </nav>

        <div className="sidebar-status">
          <span className="status-dot" />
          <span style={{ color: 'var(--accent-green)' }}>GPU Active</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>• CUDA</span>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/camera" element={<CameraPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/kiosk" element={<KioskPage />} />

      {/* Protected admin routes */}
      <Route path="/*" element={
        <PrivateRoute>
          <AdminLayout />
        </PrivateRoute>
      } />
    </Routes>
  );
}
