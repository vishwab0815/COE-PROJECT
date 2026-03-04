import { Users, UserCheck, UserX, TrendingUp } from 'lucide-react';

const CARDS = [
    { key: 'total', icon: Users, label: 'Total Students', field: 'total_students', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', iconBg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    { key: 'present', icon: UserCheck, label: 'Present Today', field: 'present', gradient: 'linear-gradient(135deg, #10b981, #059669)', iconBg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    { key: 'absent', icon: UserX, label: 'Absent Today', field: 'absent', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', iconBg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    { key: 'rate', icon: TrendingUp, label: 'Attendance Rate', field: 'percentage', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', iconBg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', suffix: '%' },
];

export default function StatCards({ stats }) {
    if (!stats) return null;

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
        }}>
            {CARDS.map((card, i) => {
                const Icon = card.icon;
                const value = stats[card.field] ?? 0;

                return (
                    <div key={card.key} className="fade-in" style={{
                        animationDelay: `${i * 0.08}s`,
                        background: '#fff',
                        borderRadius: 18,
                        padding: '22px 24px',
                        border: '1px solid var(--border-light)',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'default',
                    }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.boxShadow = `0 12px 32px ${card.color}18`;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        {/* Top accent line */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                            background: card.gradient, borderRadius: '18px 18px 0 0',
                        }} />

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 13,
                                background: card.iconBg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Icon size={22} color={card.color} strokeWidth={2} />
                            </div>
                            {/* Mini sparkline placeholder (visual flair) */}
                            <svg width="48" height="24" viewBox="0 0 48 24" style={{ opacity: 0.3 }}>
                                <polyline fill="none" stroke={card.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                    points="2,18 10,14 18,16 26,8 34,12 42,4 46,6" />
                            </svg>
                        </div>

                        <div style={{
                            fontSize: 32, fontWeight: 800, color: 'var(--text-primary)',
                            letterSpacing: '-0.03em', lineHeight: 1,
                        }}>
                            {value}{card.suffix || ''}
                        </div>
                        <div style={{
                            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                            marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                            {card.label}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
