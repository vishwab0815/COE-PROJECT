import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];

export default function AnalyticsPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const data = await api.getAttendanceStats({ date });
            setStats(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [date]);

    const barData = stats?.branch_breakdown
        ? Object.entries(stats.branch_breakdown).map(([branch, data]) => ({
            branch,
            present: data.present,
            absent: data.total - data.present,
            total: data.total,
            percentage: data.percentage,
        }))
        : [];

    const pieData = stats?.branch_breakdown
        ? Object.entries(stats.branch_breakdown).map(([branch, data]) => ({
            name: branch,
            value: data.total,
        }))
        : [];

    return (
        <>
            <div className="page-header">
                <h2>Analytics</h2>
                <p>Branch-wise attendance breakdown and trends</p>
            </div>

            <div className="page-body">
                {/* Date Filter */}
                <div className="filter-bar fade-in">
                    <input
                        className="input"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={{ maxWidth: 200 }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {stats ? `${stats.present} / ${stats.total_students} present (${stats.percentage}%)` : 'Loading...'}
                    </span>
                </div>

                {loading ? (
                    <div className="loading-center"><div className="spinner" /></div>
                ) : (
                    <>
                        {/* Overall Rate Card */}
                        <div className="card fade-in" style={{ marginBottom: 24, textAlign: 'center', padding: 40 }}>
                            <div style={{ fontSize: 60, fontWeight: 800, background: 'var(--gradient-blue)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                {stats?.percentage || 0}%
                            </div>
                            <div style={{ fontSize: 16, color: 'var(--text-muted)', marginTop: 8 }}>
                                Overall Attendance Rate — {date}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 20 }}>
                                <div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-green)' }}>{stats?.present}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Present</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-red)' }}>{stats?.absent}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Absent</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-blue)' }}>{stats?.total_students}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
                            {/* Bar Chart — Branch-wise Attendance */}
                            <div className="card fade-in">
                                <div className="card-header">
                                    <span className="card-title">Branch-wise Attendance</span>
                                </div>
                                <ResponsiveContainer width="100%" height={320}>
                                    <BarChart data={barData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                        <XAxis dataKey="branch" stroke="var(--text-muted)" fontSize={12} />
                                        <YAxis stroke="var(--text-muted)" fontSize={12} />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'var(--bg-card)',
                                                border: '1px solid var(--border-light)',
                                                borderRadius: 8,
                                                color: 'var(--text-primary)',
                                            }}
                                        />
                                        <Bar dataKey="present" fill="#10b981" name="Present" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Pie Chart — Student Distribution */}
                            <div className="card fade-in">
                                <div className="card-header">
                                    <span className="card-title">Student Distribution</span>
                                </div>
                                <ResponsiveContainer width="100%" height={320}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {pieData.map((_, index) => (
                                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                background: 'var(--bg-card)',
                                                border: '1px solid var(--border-light)',
                                                borderRadius: 8,
                                                color: 'var(--text-primary)',
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8 }}>
                                    {pieData.map((d, i) => (
                                        <span key={d.name} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                width: 8, height: 8,
                                                borderRadius: 2,
                                                backgroundColor: COLORS[i % COLORS.length],
                                                marginRight: 4,
                                            }} />
                                            {d.name} ({d.value})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Branch Cards Grid */}
                        <div className="card fade-in">
                            <div className="card-header">
                                <span className="card-title">Branch Details</span>
                            </div>
                            <div className="branch-grid">
                                {barData.map((b, i) => (
                                    <div className="branch-card" key={b.branch}>
                                        <div className="branch-name" style={{ color: COLORS[i % COLORS.length] }}>{b.branch}</div>
                                        <div className="branch-stat">{b.percentage}%</div>
                                        <div className="branch-detail">{b.present} / {b.total} present</div>
                                        <div className="progress-bar">
                                            <div
                                                className="progress-fill"
                                                style={{
                                                    width: `${b.percentage}%`,
                                                    background: `linear-gradient(135deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
