import { Clock, UserCheck } from 'lucide-react';

export default function ActivityFeed({ recentLogs }) {
    return (
        <div className="card fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="card-header" style={{ flexShrink: 0 }}>
                <span className="card-title">Recent Activity</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Auto-refresh 10s
                </span>
            </div>
            <div className="activity-feed" style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
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
                            <div style={{ textAlign: 'right', fontSize: 12 }}>
                                <div style={{ color: log.login_status === 'On Time' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                                    IN {log.login_time || '--'} {log.login_status ? `(${log.login_status})` : ''}
                                </div>
                                <div style={{ color: log.logout_status === 'Logged Out' ? '#3b82f6' : (log.logout_status ? '#ef4444' : 'var(--text-muted)'), marginTop: 2, fontWeight: 600 }}>
                                    OUT {log.logout_time || '--'} {log.logout_status ? `(${log.logout_status})` : ''}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
