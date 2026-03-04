import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Search, Users, Trash2, AlertTriangle, GraduationCap, ChevronLeft, ChevronRight, UserX, Hash, User, BookOpen } from 'lucide-react';

// Branch color mapping for unique visual identity
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

export default function StudentsPage() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [branch, setBranch] = useState('');
    const [page, setPage] = useState(0);
    const [deleting, setDeleting] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const LIMIT = 25;

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const params = { limit: LIMIT, skip: page * LIMIT };
            if (search) params.search = search;
            if (branch) params.branch = branch;
            const data = await api.getStudents(params);
            setStudents(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, [search, branch, page]);

    const handleDelete = async (rollNo) => {
        setDeleting(rollNo);
        try {
            await api.deleteStudent(rollNo);
            setConfirmDelete(null);
            fetchStudents();
        } catch (err) {
            alert(`Failed to delete: ${err.message}`);
        } finally {
            setDeleting(null);
        }
    };

    return (
        <>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                            width: 36, height: 36, borderRadius: 12,
                            background: 'var(--gradient-primary)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 14px rgba(13, 148, 136, 0.2)'
                        }}>
                            <GraduationCap size={20} color="#fff" />
                        </span>
                        Students
                    </h2>
                    <p>Browse, search, and manage registered students</p>
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(13, 148, 136, 0.06)', padding: '8px 16px',
                    borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 700,
                    color: 'var(--accent-primary)'
                }}>
                    <Users size={15} />
                    {students.length} students
                </div>
            </div>

            <div className="page-body">
                {/* ── Premium Filter Bar ── */}
                <div className="fade-in" style={{
                    display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
                    marginBottom: 24, padding: '16px 20px',
                    background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)',
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 360 }}>
                        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            className="input"
                            placeholder="Search by name or roll number..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                            style={{ paddingLeft: 40, background: 'rgba(255,255,255,0.9)', borderRadius: 'var(--radius-sm)' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['', 'CSE', 'AIML', 'ISE', 'ECE', 'ME', 'EEE', 'CIVIL', 'CSD', 'CSDS'].map(b => {
                            const isActive = branch === b;
                            const style = b ? getBranchStyle(b) : DEFAULT_BRANCH;
                            return (
                                <button
                                    key={b}
                                    onClick={() => { setBranch(b); setPage(0); }}
                                    style={{
                                        padding: '6px 14px', borderRadius: 'var(--radius-full)',
                                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                        border: isActive ? `1.5px solid ${style.color}` : '1.5px solid transparent',
                                        background: isActive ? style.bg : 'rgba(0,0,0,0.02)',
                                        color: isActive ? style.color : 'var(--text-muted)',
                                        transition: 'all 0.2s', fontFamily: 'var(--font)',
                                        letterSpacing: '0.02em'
                                    }}
                                >
                                    {b || 'All'}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Student Cards ── */}
                {loading ? (
                    <div className="loading-center"><div className="spinner" /></div>
                ) : students.length === 0 ? (
                    <div className="empty-state fade-in">
                        <UserX size={48} />
                        <h3>No students found</h3>
                        <p>Try changing the search or filter</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: 14
                    }}>
                        {students.map((s, i) => {
                            const brStyle = getBranchStyle(s.branch);
                            return (
                                <div
                                    key={s.roll_no}
                                    className="fade-in"
                                    style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: '18px 20px',
                                        display: 'flex', alignItems: 'center', gap: 16,
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: 'var(--shadow-card)',
                                        cursor: 'default',
                                        animationDelay: `${Math.min(i * 0.03, 0.3)}s`,
                                        position: 'relative', overflow: 'hidden'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.transform = 'translateY(-3px)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
                                        e.currentTarget.style.borderColor = brStyle.color + '30';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                                        e.currentTarget.style.borderColor = 'var(--border-color)';
                                    }}
                                >
                                    {/* Top accent line */}
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                                        background: brStyle.gradient, opacity: 0.6
                                    }} />

                                    {/* Avatar */}
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                                        background: brStyle.gradient,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 16, fontWeight: 800, color: '#fff',
                                        boxShadow: `0 4px 12px ${brStyle.color}30`,
                                        letterSpacing: '-0.02em'
                                    }}>
                                        {getInitials(s.name)}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 15, fontWeight: 800, color: 'var(--text-primary)',
                                            letterSpacing: '-0.02em', marginBottom: 4,
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}>
                                            {s.name}
                                        </div>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'
                                        }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                                                background: 'rgba(0,0,0,0.03)', padding: '3px 10px',
                                                borderRadius: 'var(--radius-full)',
                                                fontFamily: 'var(--font)', letterSpacing: '0.02em'
                                            }}>
                                                <Hash size={11} strokeWidth={2.5} />
                                                {s.roll_no}
                                            </span>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                fontSize: 11, fontWeight: 700,
                                                background: brStyle.bg, color: brStyle.color,
                                                padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                                letterSpacing: '0.03em'
                                            }}>
                                                <BookOpen size={10} strokeWidth={2.5} />
                                                {s.branch}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(s); }}
                                        disabled={deleting === s.roll_no}
                                        style={{
                                            background: 'none', border: '1.5px solid transparent',
                                            cursor: 'pointer', color: 'var(--text-muted)',
                                            padding: 8, borderRadius: 10,
                                            transition: 'all 0.2s', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.color = '#ef4444';
                                            e.currentTarget.style.background = 'rgba(239,68,68,0.06)';
                                            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.color = 'var(--text-muted)';
                                            e.currentTarget.style.background = 'none';
                                            e.currentTarget.style.borderColor = 'transparent';
                                        }}
                                        title={`Delete ${s.name}`}
                                    >
                                        {deleting === s.roll_no
                                            ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                            : <Trash2 size={15} />
                                        }
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Pagination ── */}
                <div style={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    gap: 8, marginTop: 24
                }}>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                        <ChevronLeft size={14} /> Previous
                    </button>

                    <div style={{
                        padding: '6px 18px', borderRadius: 'var(--radius-full)',
                        background: 'var(--gradient-primary)', color: '#fff',
                        fontSize: 12, fontWeight: 800, letterSpacing: '0.02em',
                        boxShadow: '0 2px 8px rgba(13, 148, 136, 0.2)'
                    }}>
                        Page {page + 1}
                    </div>

                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={students.length < LIMIT}
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                        Next <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* ═══ DELETE CONFIRMATION MODAL ═══ */}
            {confirmDelete && (
                <div
                    onClick={() => setConfirmDelete(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 99999,
                        background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'fadeIn 0.15s ease',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#fff', borderRadius: 24, padding: '32px 36px',
                            width: 420, maxWidth: '90vw', textAlign: 'center',
                            border: '2px solid rgba(239,68,68,0.15)',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.03)',
                            animation: 'fadeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                    >
                        <div style={{
                            width: 60, height: 60, borderRadius: '50%',
                            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 18px',
                        }}>
                            <AlertTriangle size={28} />
                        </div>
                        <h3 style={{ fontSize: 19, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                            Delete Student?
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
                            This action is irreversible. The following will be permanently removed:
                        </p>
                        <div style={{
                            background: 'rgba(239,68,68,0.03)', borderRadius: 16, padding: '16px 20px',
                            textAlign: 'left', marginBottom: 24, fontSize: 13,
                            border: '1px solid rgba(239,68,68,0.08)'
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
                                paddingBottom: 12, borderBottom: '1px solid rgba(0,0,0,0.04)'
                            }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                                    background: getBranchStyle(confirmDelete.branch).gradient,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 14, fontWeight: 800, color: '#fff'
                                }}>
                                    {getInitials(confirmDelete.name)}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                                        {confirmDelete.name}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                                        {confirmDelete.roll_no} • {confirmDelete.branch}
                                    </div>
                                </div>
                            </div>
                            <div style={{ color: 'var(--text-muted)', lineHeight: 2, fontSize: 12, fontWeight: 500 }}>
                                ✕ Student record from database<br />
                                ✕ All face embeddings from FAISS index<br />
                                ✕ All captured registration photos<br />
                                ✕ All attendance history records
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setConfirmDelete(null)}
                                style={{ flex: 1, justifyContent: 'center', borderRadius: 14 }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleDelete(confirmDelete.roll_no)}
                                disabled={deleting}
                                style={{ flex: 1, justifyContent: 'center', borderRadius: 14 }}
                            >
                                {deleting ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
