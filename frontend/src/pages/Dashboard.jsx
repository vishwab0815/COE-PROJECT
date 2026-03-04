import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Clock, LayoutDashboard } from 'lucide-react';
import StatCards from '../components/dashboard/StatCards';
import BranchBreakdown from '../components/dashboard/BranchBreakdown';
import ShiftSettings from '../components/dashboard/ShiftSettings';
import ActivityFeed from '../components/dashboard/ActivityFeed';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [recentLogs, setRecentLogs] = useState([]);
    const [shiftConfig, setShiftConfig] = useState({ login_time: "09:30", logout_time: "16:30" });
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    const today = new Date().toISOString().split('T')[0];

    const fetchData = async () => {
        try {
            const [statsData, logs, shiftData] = await Promise.all([
                api.getAttendanceStats({ date: today }),
                api.getAttendanceReport({ date: today, limit: 10 }),
                api.getShiftConfig()
            ]);
            setStats(statsData);
            setRecentLogs(logs);
            if (shiftData) {
                setShiftConfig({
                    login_time: shiftData.login_time.substring(0, 5),
                    logout_time: shiftData.logout_time.substring(0, 5)
                });
            }
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleConfigSave = async () => {
        try {
            await api.updateShiftConfig({
                login_time: shiftConfig.login_time + ":00",
                logout_time: shiftConfig.logout_time + ":00"
            });
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => {
            clearInterval(interval);
            clearInterval(clockInterval);
        };
    }, []);

    const timeString = currentTime.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    if (loading) {
        return (
            <>
                <div className="page-header">
                    <h2>Dashboard</h2>
                    <p>Real-time attendance overview</p>
                </div>
                <div className="page-body">
                    <div className="loading-center"><div className="spinner" /></div>
                </div>
            </>
        );
    }

    return (
        <>
            {/* ── Premium Header ── */}
            <div className="page-header" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 13,
                        background: 'var(--gradient-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 14px rgba(13, 148, 136, 0.25)',
                    }}>
                        <LayoutDashboard size={22} color="#fff" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Dashboard</h2>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                            Real-time attendance overview — {today}
                        </p>
                    </div>
                </div>

                {/* Live Clock */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 18px',
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid var(--border-light)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}>
                    <Clock size={15} color="var(--accent-primary)" strokeWidth={2.5} />
                    <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700, fontSize: 15,
                        letterSpacing: '0.05em',
                        color: 'var(--text-primary)',
                    }}>
                        {timeString}
                    </span>
                    <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: '#fff', background: 'var(--gradient-primary)',
                        padding: '2px 7px', borderRadius: 5,
                        letterSpacing: '0.04em',
                    }}>
                        IST
                    </span>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="page-body" style={{
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden', gap: 20,
            }}>
                {/* Stat Cards Row */}
                <StatCards stats={stats} />

                {/* Two Column Layout */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr',
                    gap: 20, flex: 1, minHeight: 0,
                }}>
                    {/* Left Column — Branch + Shift */}
                    <div style={{
                        display: 'flex', flexDirection: 'column',
                        gap: 16, minHeight: 0, height: '100%',
                    }}>
                        <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <BranchBreakdown stats={stats} />
                        </div>
                        <div style={{ flexShrink: 0, position: 'relative', overflow: 'visible', zIndex: 50 }}>
                            <ShiftSettings
                                shiftConfig={shiftConfig}
                                setShiftConfig={setShiftConfig}
                                handleConfigSave={handleConfigSave}
                            />
                        </div>
                    </div>

                    {/* Right Column — Activity Feed */}
                    <ActivityFeed recentLogs={recentLogs} />
                </div>
            </div>
        </>
    );
}
