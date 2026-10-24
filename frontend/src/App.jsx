import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Camera, Users, ClipboardList, BarChart3, UserPlus, LogOut, Scan } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { api } from './services/api';
import PrivateRoute from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import KioskPage from './pages/KioskPage';

// Admin pages load on demand — recharts (Analytics) and react-webcam (Register)
// stay out of the bundle that the login and kiosk screens download.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CameraPage = lazy(() => import('./pages/CameraPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const StudentsPage = lazy(() => import('./pages/StudentsPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));

const pageFallback = <div className="page-body"><div className="loading-center"><div className="spinner" /></div></div>;

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/camera', icon: Camera, label: 'Mark Attendance' },
  { to: '/register', icon: UserPlus, label: 'Register Student' },
  { to: '/students', icon: Users, label: 'Students' },
  { to: '/attendance', icon: ClipboardList, label: 'Attendance Logs' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
];

function useEngineStatus() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    const check = () => api.health().then(setHealth).catch(() => setHealth(null));
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);
  return health;
}

function AdminLayout() {
  const { logout } = useAuth();
  const health = useEngineStatus();
  const online = health?.face_engine === 'ready';

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
          <span className="status-dot" style={online ? undefined : { background: 'var(--accent-red)', boxShadow: 'none' }} />
          <span style={{ color: online ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {online ? 'Engine Active' : 'Backend Offline'}
          </span>
          {online && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>• {health.gpu.toUpperCase()}</span>}
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <Suspense fallback={pageFallback}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/camera" element={<CameraPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
        </Suspense>
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
