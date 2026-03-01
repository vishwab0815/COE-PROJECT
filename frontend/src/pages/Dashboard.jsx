import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Clock } from 'lucide-react';
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
            // Visual feedback could be added here
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Refresh every 10s
        const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => {
            clearInterval(interval);
            clearInterval(clockInterval);
        };
    }, []);

    const timeString = currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });

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
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Dashboard</h2>
                    <p>Real-time attendance overview — {today}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Clock size={16} color="var(--accent-primary)" />
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, letterSpacing: '0.05em' }}>{timeString} (IST)</span>
                </div>
            </div>

            <div className="page-body" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <StatCards stats={stats} />

                {/* Two Column Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24, flex: 1, minHeight: 0, marginTop: 24 }}>

                    {/* Left Column Container */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minHeight: 0, height: '100%' }}>
                        <div style={{ flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <BranchBreakdown stats={stats} />
                        </div>
                        <div style={{ flexShrink: 0 }}>
                            <ShiftSettings
                                shiftConfig={shiftConfig}
                                setShiftConfig={setShiftConfig}
                                handleConfigSave={handleConfigSave}
                            />
                        </div>
                    </div>

                    <ActivityFeed recentLogs={recentLogs} />

                </div>
            </div>
        </>
    );
}
