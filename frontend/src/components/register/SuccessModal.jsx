import { CheckCircle, UserPlus, LayoutDashboard, Hash, User, BookOpen, Fingerprint } from 'lucide-react';

// Branch color mapping (shared with StudentsPage)
const BRANCH_COLORS = {
    CSE: { bg: 'rgba(14, 165, 233, 0.08)', color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' },
    AIML: { bg: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' },
    ISE: { bg: 'rgba(16, 185, 129, 0.08)', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
    ECE: { bg: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
    ME: { bg: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #f87171)' },
    EEE: { bg: 'rgba(6, 182, 212, 0.08)', color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)' },
    CIVIL: { bg: 'rgba(234, 88, 12, 0.08)', color: '#ea580c', gradient: 'linear-gradient(135deg, #ea580c, #f97316)' },
    CSD: { bg: 'rgba(236, 72, 153, 0.08)', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #f472b6)' },
    CSDS: { bg: 'rgba(99, 102, 241, 0.08)', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #818cf8)' },
};
const DEFAULT_BRANCH = { bg: 'rgba(13, 148, 136, 0.08)', color: '#0d9488', gradient: 'linear-gradient(135deg, #0d9488, #14b8a6)' };

function getBranchStyle(branch) {
    return BRANCH_COLORS[branch?.toUpperCase()] || DEFAULT_BRANCH;
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0]?.toUpperCase() || '?';
}

/**
 * SuccessModal — Shown after a successful registration with all details.
 */
export default function SuccessModal({ result, onReset, onDashboard }) {
    const brStyle = getBranchStyle(result.branch);

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: '#fff', borderRadius: 28, padding: '36px 40px',
                width: 440, maxWidth: '90vw', textAlign: 'center',
                border: '1px solid rgba(16,185,129,0.15)',
                boxShadow: '0 24px 64px rgba(16,185,129,0.12), 0 0 0 1px rgba(0,0,0,0.02)',
                animation: 'fadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
                {/* Success icon */}
                <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'rgba(16,185,129,0.08)', color: '#10b981',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 18px',
                    boxShadow: '0 0 0 8px rgba(16,185,129,0.04)'
                }}>
                    <CheckCircle size={36} />
                </div>

                <h3 style={{
                    fontSize: 22, fontWeight: 800, marginBottom: 6,
                    letterSpacing: '-0.03em', color: 'var(--text-primary)'
                }}>
                    Registration Successful!
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, fontWeight: 500 }}>
                    {result.name} is now enrolled and can be recognized by the AI
                </p>

                {/* Student info card */}
                <div style={{
                    background: 'rgba(240, 253, 250, 0.5)', borderRadius: 18, padding: '20px 24px',
                    textAlign: 'left', marginBottom: 24,
                    border: '1px solid rgba(13, 148, 136, 0.08)'
                }}>
                    {/* Student identity row */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        paddingBottom: 16, marginBottom: 16,
                        borderBottom: '1px solid rgba(0,0,0,0.04)'
                    }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                            background: brStyle.gradient,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, fontWeight: 800, color: '#fff',
                            boxShadow: `0 4px 12px ${brStyle.color}30`,
                        }}>
                            {getInitials(result.name)}
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                                {result.name}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                <span style={{
                                    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                                    background: 'rgba(0,0,0,0.03)', padding: '2px 8px',
                                    borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', gap: 3
                                }}>
                                    <Hash size={10} />{result.roll_no}
                                </span>
                                <span style={{
                                    fontSize: 11, fontWeight: 700,
                                    background: brStyle.bg, color: brStyle.color,
                                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                    display: 'inline-flex', alignItems: 'center', gap: 3
                                }}>
                                    <BookOpen size={10} />{result.branch}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Embeddings</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981', marginTop: 4, letterSpacing: '-0.02em' }}>{result.embeddings_added}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Images</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4, letterSpacing: '-0.02em' }}>{result.total_images}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Saved</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent-primary)', marginTop: 4, letterSpacing: '-0.02em' }}>{result.images_saved}</div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-outline" onClick={onReset} style={{ flex: 1, justifyContent: 'center', borderRadius: 14 }}>
                        <UserPlus size={15} /> Register Another
                    </button>
                    <button className="btn btn-primary" onClick={onDashboard} style={{ flex: 1, justifyContent: 'center', borderRadius: 14 }}>
                        <LayoutDashboard size={15} /> Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
