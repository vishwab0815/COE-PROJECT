import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Camera, Users, ClipboardList, BarChart3, UserPlus } from 'lucide-react';
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

export default function App() {
  const location = useLocation();

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">🎯</div>
          <div>
            <h1>Attendance AI</h1>
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
