export default function BranchBreakdown({ stats }) {
    if (!stats?.branch_breakdown) return null;

    return (
        <div className="card fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div className="card-header" style={{ flexShrink: 0, marginBottom: 10, padding: '0 0 10px 0' }}>
                <span className="card-title" style={{ fontSize: 12 }}>Branch Breakdown</span>
            </div>
            <div className="branch-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', overflowY: 'auto', flex: 1, paddingBottom: 8, minHeight: 0, gap: 10 }}>
                {Object.entries(stats.branch_breakdown).map(([branch, data]) => (
                    <div className="branch-card" key={branch} style={{ padding: 14 }}>
                        <div className="branch-name" style={{ fontSize: 12, marginBottom: 6 }}>{branch}</div>
                        <div className="branch-stat" style={{ fontSize: 22 }}>{data.percentage}%</div>
                        <div className="branch-detail" style={{ fontSize: 11 }}>{data.present}/{data.total}</div>
                        <div className="progress-bar" style={{ marginTop: 8, height: 4 }}>
                            <div className="progress-fill" style={{ width: `${data.percentage}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
