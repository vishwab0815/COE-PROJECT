import { getBranchStyle } from '../../utils/branchColors';
import { BookOpen } from 'lucide-react';

export default function BranchBreakdown({ stats }) {
    if (!stats?.branch_breakdown) return null;

    const entries = Object.entries(stats.branch_breakdown);

    return (
        <div style={{
            background: '#fff', borderRadius: 18, padding: '20px 24px',
            border: '1px solid var(--border-light)', flex: 1,
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
                        background: 'rgba(13,148,136,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <BookOpen size={16} color="#0d9488" strokeWidth={2.5} />
                    </div>
                    <span style={{
                        fontSize: 13, fontWeight: 800, color: 'var(--text-primary)',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                        Branch Breakdown
                    </span>
                </div>
                <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                    background: 'rgba(0,0,0,0.03)', padding: '4px 10px', borderRadius: 8,
                }}>
                    {entries.length} branches
                </span>
            </div>

            {/* Branch List */}
            <div style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                overflowY: 'auto', flex: 1, minHeight: 0, paddingRight: 4,
            }}>
                {entries.map(([branch, data]) => {
                    const style = getBranchStyle(branch);

                    return (
                        <div key={branch} style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '12px 14px', borderRadius: 13,
                            background: 'rgba(0,0,0,0.015)',
                            border: '1px solid var(--border-light)',
                            transition: 'all 0.2s',
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = style.bg;
                                e.currentTarget.style.borderColor = `${style.color}30`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(0,0,0,0.015)';
                                e.currentTarget.style.borderColor = 'var(--border-light)';
                            }}
                        >
                            {/* Branch Badge */}
                            <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: style.gradient,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: `0 3px 10px ${style.color}25`,
                            }}>
                                <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', letterSpacing: '0.02em' }}>
                                    {branch}
                                </span>
                            </div>

                            {/* Progress Section */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                        {data.present} / {data.total} present
                                    </span>
                                    <span style={{ fontSize: 14, fontWeight: 800, color: style.color }}>
                                        {data.percentage}%
                                    </span>
                                </div>
                                {/* Progress bar */}
                                <div style={{
                                    height: 6, borderRadius: 3,
                                    background: 'rgba(0,0,0,0.05)',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{
                                        height: '100%', borderRadius: 3,
                                        background: style.gradient,
                                        width: `${data.percentage}%`,
                                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
