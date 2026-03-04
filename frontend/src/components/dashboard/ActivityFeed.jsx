import { Clock, ArrowDownLeft, ArrowUpRight, UserCheck } from 'lucide-react';
import { getBranchStyle, getInitials } from '../../utils/branchColors';

export default function ActivityFeed({ recentLogs }) {
    return (
        <div style={{
            background: '#fff', borderRadius: 18, padding: '20px 24px',
            border: '1px solid var(--border-light)',
            display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 16, flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 9,
                        background: 'rgba(59,130,246,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Clock size={16} color="#3b82f6" strokeWidth={2.5} />
                    </div>
                    <span style={{
                        fontSize: 13, fontWeight: 800, color: 'var(--text-primary)',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                        Recent Activity
                    </span>
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                    background: 'rgba(0,0,0,0.03)', padding: '4px 10px', borderRadius: 8,
                }}>
                    <div style={{
                        width: 6, height: 6, borderRadius: '50%', background: '#10b981',
                        animation: 'pulse 2s ease-in-out infinite',
                    }} />
                    Live • 10s
                </div>
            </div>

            {/* Activity List */}
            <div style={{
                flex: 1, overflowY: 'auto', paddingRight: 4,
                display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0,
            }}>
                {recentLogs.length === 0 ? (
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-muted)', gap: 8, padding: 32,
                    }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: 14,
                            background: 'rgba(0,0,0,0.03)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <UserCheck size={24} color="var(--text-muted)" />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>No activity today</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>Start marking attendance to see logs</span>
                    </div>
                ) : (
                    recentLogs.map((log, i) => {
                        const branchStyle = getBranchStyle(log.branch);
                        const initials = getInitials(log.name);

                        return (
                            <div key={i} className="fade-in" style={{
                                animationDelay: `${i * 0.05}s`,
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 12px', borderRadius: 13,
                                background: 'rgba(0,0,0,0.012)',
                                border: '1px solid transparent',
                                transition: 'all 0.2s',
                            }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(0,0,0,0.025)';
                                    e.currentTarget.style.borderColor = 'var(--border-light)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(0,0,0,0.012)';
                                    e.currentTarget.style.borderColor = 'transparent';
                                }}
                            >
                                {/* Avatar */}
                                <div style={{
                                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                                    background: branchStyle.gradient,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: `0 3px 10px ${branchStyle.color}20`,
                                }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{initials}</span>
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {log.name}
                                    </div>
                                    <div style={{
                                        fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
                                        marginTop: 1,
                                    }}>
                                        {log.roll_no} •{' '}
                                        <span style={{ color: branchStyle.color, fontWeight: 700 }}>{log.branch}</span>
                                    </div>
                                </div>

                                {/* Time badges */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, alignItems: 'flex-end' }}>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        fontSize: 11, fontWeight: 700, borderRadius: 7, padding: '2px 8px',
                                        background: log.login_status === 'On Time' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                                        color: log.login_status === 'On Time' ? '#10b981' : '#f59e0b',
                                    }}>
                                        <ArrowDownLeft size={10} strokeWidth={3} />
                                        {log.login_time || '--'}
                                    </div>
                                    {log.logout_time && (
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            fontSize: 11, fontWeight: 700, borderRadius: 7, padding: '2px 8px',
                                            background: log.logout_status === 'Logged Out' ? 'rgba(59,130,246,0.08)' : 'rgba(239,68,68,0.08)',
                                            color: log.logout_status === 'Logged Out' ? '#3b82f6' : '#ef4444',
                                        }}>
                                            <ArrowUpRight size={10} strokeWidth={3} />
                                            {log.logout_time}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
