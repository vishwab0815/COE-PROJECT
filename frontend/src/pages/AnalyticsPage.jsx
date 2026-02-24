import { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, Legend, RadialBarChart, RadialBar,
} from 'recharts';
import { TrendingUp, Users, UserCheck, UserX, Activity } from 'lucide-react';
import DatePicker from '../components/DatePicker';

const COLORS = ['#0d9488', '#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
        <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            fontFamily: 'var(--font)',
        }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6, color: '#0f172a' }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 2 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ color: '#64748b' }}>{p.name}:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{p.value}</span>
                </div>
            ))}
        </div>
    );
};

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

    useEffect(() => { fetchStats(); }, [date]);

    const barData = stats?.branch_breakdown
        ? Object.entries(stats.branch_breakdown).map(([branch, data]) => ({
            branch,
            Present: data.present,
            Absent: data.total - data.present,
            total: data.total,
            percentage: data.percentage,
        }))
        : [];

    const pieData = stats?.branch_breakdown
        ? Object.entries(stats.branch_breakdown).map(([branch, data]) => ({
            name: branch, value: data.total,
        }))
        : [];

    const radialData = barData.map((b, i) => ({
        name: b.branch,
        rate: b.percentage,
        fill: COLORS[i % COLORS.length],
    }));

    const overallRate = stats?.percentage || 0;

    return (
        <>
            <div className="page-header">
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Activity size={22} style={{ color: 'var(--accent-primary)' }} />
                        Analytics Dashboard
                    </h2>
                    <p>Real-time attendance insights and performance metrics</p>
                </div>
            </div>

            <div className="page-body">
                {loading ? (
                    <div className="loading-center"><div className="spinner" /></div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                            <DatePicker value={date} onChange={setDate} />
                        </div>
                        {/* ═══ KPI CARDS ROW ═══ */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }} className="fade-in">
                            {[
                                { label: 'Total Students', value: stats?.total_students || 0, icon: Users, color: '#0d9488', bg: 'rgba(13,148,136,0.08)' },
                                { label: 'Present Today', value: stats?.present || 0, icon: UserCheck, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
                                { label: 'Absent Today', value: stats?.absent || 0, icon: UserX, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
                                { label: 'Attendance Rate', value: `${overallRate}%`, icon: TrendingUp, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
                            ].map((kpi, i) => (
                                <div key={i} style={{
                                    background: '#fff', border: '1px solid var(--border-color)', borderRadius: 16,
                                    padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16,
                                    boxShadow: 'var(--shadow-xs)', transition: 'all 0.3s',
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; }}
                                >
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 14, background: kpi.bg,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        <kpi.icon size={22} style={{ color: kpi.color }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: '#0f172a', lineHeight: 1 }}>{kpi.value}</div>
                                        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginTop: 4 }}>{kpi.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ═══ MAIN CHARTS ROW ═══ */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, marginBottom: 20 }}>
                            {/* Stacked Bar Chart */}
                            <div className="card fade-in" style={{ padding: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>Branch Performance</div>
                                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: 500 }}>Present vs Absent by department</div>
                                    </div>
                                    <div style={{ padding: '4px 12px', background: 'rgba(13,148,136,0.08)', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#0d9488' }}>
                                        {date}
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={barData} barSize={36} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="branch" stroke="#94a3b8" fontSize={12} fontWeight={700} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                                        <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="Absent" stackId="a" fill="#fee2e2" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Donut Chart */}
                            <div className="card fade-in" style={{ padding: 24 }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4, letterSpacing: '-0.01em' }}>Student Distribution</div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16, fontWeight: 500 }}>Students per department</div>
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Legend */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                                    {pieData.map((d, i) => (
                                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 8, background: '#f8fafc' }}>
                                            <span style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{d.name}</span>
                                            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto', fontWeight: 600 }}>{d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ═══ BOTTOM ROW ═══ */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            {/* Radial Rate Chart */}
                            <div className="card fade-in" style={{ padding: 24 }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4, letterSpacing: '-0.01em' }}>Department Rates</div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16, fontWeight: 500 }}>Attendance percentage by branch</div>
                                <ResponsiveContainer width="100%" height={220}>
                                    <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={radialData} startAngle={180} endAngle={0}>
                                        <RadialBar background clockWise dataKey="rate" cornerRadius={6} />
                                        <Tooltip content={<CustomTooltip />} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 8 }}>
                                    {radialData.map(d => (
                                        <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}>
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.fill }} />
                                            <span style={{ color: '#475569' }}>{d.name}</span>
                                            <span style={{ color: '#94a3b8' }}>{d.rate}%</span>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Branch Detail Cards */}
                            <div className="card fade-in" style={{ padding: 24 }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4, letterSpacing: '-0.01em' }}>Branch Scorecard</div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16, fontWeight: 500 }}>Detailed performance per department</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {barData.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>No data for this date</div>
                                    ) : (
                                        barData.map((b, i) => (
                                            <div key={b.branch} style={{
                                                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                                                background: '#f8fafc', borderRadius: 12, transition: 'all 0.2s',
                                            }}>
                                                <div style={{
                                                    width: 40, height: 40, borderRadius: 10,
                                                    background: `${COLORS[i % COLORS.length]}15`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 13, fontWeight: 800, color: COLORS[i % COLORS.length], flexShrink: 0,
                                                }}>
                                                    {b.branch.slice(0, 2)}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{b.branch}</span>
                                                        <span style={{ fontSize: 13, fontWeight: 800, color: COLORS[i % COLORS.length] }}>{b.percentage}%</span>
                                                    </div>
                                                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%', borderRadius: 3,
                                                            background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
                                                            width: `${b.percentage}%`, transition: 'width 0.6s ease',
                                                        }} />
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>
                                                        {b.Present} present • {b.Absent} absent • {b.total} total
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
