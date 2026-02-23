import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, UserCheck, UserX, TrendingUp, Clock } from 'lucide-react';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [recentLogs, setRecentLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const today = new Date().toISOString().split('T')[0];

    const fetchData = async () => {
        try {
            const [statsData, logs] = await Promise.all([
                api.getAttendanceStats({ date: today }),
                api.getAttendanceReport({ date: today, limit: 10 }),
            ]);
            setStats(statsData);
            setRecentLogs(logs);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, []);

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
            <div className="page-header">
                <h2>Dashboard</h2>
                <p>Real-time attendance overview — {today}</p>
            </div>

            <div className="page-body">
                {/* Stat Cards */}
                <div className="stats-grid fade-in">
                    <div className="stat-card blue">
                        <div className="stat-icon"><Users size={20} /></div>
                        <div className="stat-value">{stats?.total_students || 0}</div>
                        <div className="stat-label">Total Students</div>
                    </div>

                    <div className="stat-card green">
                        <div className="stat-icon"><UserCheck size={20} /></div>
                        <div className="stat-value">{stats?.present || 0}</div>
                        <div className="stat-label">Present Today</div>
                    </div>

                    <div className="stat-card orange">
                        <div className="stat-icon"><UserX size={20} /></div>
                        <div className="stat-value">{stats?.absent || 0}</div>
                        <div className="stat-label">Absent Today</div>
                    </div>

                    <div className="stat-card purple">
                        <div className="stat-icon"><TrendingUp size={20} /></div>
                        <div className="stat-value">{stats?.percentage || 0}%</div>
                        <div className="stat-label">Attendance Rate</div>
                    </div>
                </div>

                {/* Two Column Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    {/* Branch Breakdown */}
                    <div className="card fade-in">
                        <div className="card-header">
                            <span className="card-title">Branch Breakdown</span>
                        </div>
                        <div className="branch-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            {stats?.branch_breakdown && Object.entries(stats.branch_breakdown).map(([branch, data]) => (
                                <div className="branch-card" key={branch}>
                                    <div className="branch-name">{branch}</div>
                                    <div className="branch-stat">{data.percentage}%</div>
                                    <div className="branch-detail">{data.present}/{data.total}</div>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${data.percentage}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="card fade-in">
                        <div className="card-header">
                            <span className="card-title">Recent Activity</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                Auto-refresh 10s
                            </span>
                        </div>
                        <div className="activity-feed">
                            {recentLogs.length === 0 ? (
                                <div className="empty-state">
                                    <UserCheck size={32} />
                                    <h3>No attendance today</h3>
                                    <p>Go to Mark Attendance to start</p>
                                </div>
                            ) : (
                                recentLogs.map((log, i) => (
                                    <div className="activity-item" key={i}>
                                        <div className="activity-avatar">
                                            {log.name?.charAt(0) || '?'}
                                        </div>
                                        <div className="activity-info">
                                            <div className="activity-name">{log.name}</div>
                                            <div className="activity-detail">{log.roll_no} • {log.branch}</div>
                                        </div>
                                        <div className="activity-time">{log.time}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
