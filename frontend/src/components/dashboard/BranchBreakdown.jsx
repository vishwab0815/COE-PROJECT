export default function BranchBreakdown({ stats }) {
    if (!stats?.branch_breakdown) return null;

    return (
        <div className="card fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="card-header" style={{ flexShrink: 0, marginBottom: 12 }}>
                <span className="card-title">Branch Breakdown</span>
            </div>
            <div className="branch-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', overflowY: 'auto', flex: 1, paddingBottom: 12, minHeight: 0 }}>
                {Object.entries(stats.branch_breakdown).map(([branch, data]) => (
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
    );
}
