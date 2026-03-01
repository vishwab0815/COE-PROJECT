import { Users, UserCheck, UserX, TrendingUp } from 'lucide-react';

export default function StatCards({ stats }) {
    if (!stats) return null;

    return (
        <div className="stats-grid">
            <div className="stat-card fade-in">
                <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    <Users size={24} />
                </div>
                <div className="stat-value">{stats.total_students || 0}</div>
                <div className="stat-label">Total Students</div>
            </div>

            <div className="stat-card fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    <UserCheck size={24} />
                </div>
                <div className="stat-value">{stats.present || 0}</div>
                <div className="stat-label">Present Today</div>
            </div>

            <div className="stat-card fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                    <UserX size={24} />
                </div>
                <div className="stat-value">{stats.absent || 0}</div>
                <div className="stat-label">Absent Today</div>
            </div>

            <div className="stat-card fade-in" style={{ animationDelay: '0.3s' }}>
                <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                    <TrendingUp size={24} />
                </div>
                <div className="stat-value">{stats.percentage || 0}%</div>
                <div className="stat-label">Attendance Rate</div>
            </div>
        </div>
    );
}
