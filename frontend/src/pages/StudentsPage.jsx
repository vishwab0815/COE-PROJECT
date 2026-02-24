import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Search, Users, Trash2, AlertTriangle } from 'lucide-react';

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
            <div className="page-header">
                <h2>Students</h2>
                <p>Browse, search, and manage registered students</p>
            </div>

            <div className="page-body">
                {/* Filters */}
                <div className="filter-bar fade-in">
                    <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            className="input"
                            placeholder="Search by name or roll number..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                            style={{ paddingLeft: 36 }}
                        />
                    </div>

                    <select
                        className="select"
                        value={branch}
                        onChange={(e) => { setBranch(e.target.value); setPage(0); }}
                        style={{ maxWidth: 160 }}
                    >
                        <option value="">All Branches</option>
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="ME">ME</option>
                        <option value="EEE">EEE</option>
                        <option value="CIVIL">CIVIL</option>
                        <option value="ISE">ISE</option>
                        <option value="AIML">AIML</option>
                        <option value="CSD">CSD</option>
                        <option value="CSDS">CSDS</option>
                    </select>

                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                        <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Showing {students.length} students
                    </span>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="loading-center"><div className="spinner" /></div>
                ) : (
                    <div className="card fade-in" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Roll Number</th>
                                        <th>Name</th>
                                        <th>Branch</th>
                                        <th style={{ textAlign: 'center', width: 80 }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                                No students found
                                            </td>
                                        </tr>
                                    ) : (
                                        students.map((s, i) => (
                                            <tr key={s.roll_no}>
                                                <td style={{ color: 'var(--text-muted)' }}>{page * LIMIT + i + 1}</td>
                                                <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.roll_no}</td>
                                                <td>{s.name}</td>
                                                <td><span className="badge branch">{s.branch}</span></td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => setConfirmDelete(s)}
                                                        disabled={deleting === s.roll_no}
                                                        style={{
                                                            background: 'none', border: 'none', cursor: 'pointer',
                                                            color: 'var(--text-muted)', padding: 6, borderRadius: 8,
                                                            transition: 'all 0.2s',
                                                        }}
                                                        onMouseEnter={(e) => { e.target.style.color = 'var(--accent-red)'; e.target.style.background = 'rgba(239,68,68,0.08)'; }}
                                                        onMouseLeave={(e) => { e.target.style.color = 'var(--text-muted)'; e.target.style.background = 'none'; }}
                                                        title={`Delete ${s.name}`}
                                                    >
                                                        {deleting === s.roll_no
                                                            ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                                            : <Trash2 size={16} />
                                                        }
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Pagination */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                    >
                        Previous
                    </button>
                    <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                        Page {page + 1}
                    </span>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={students.length < LIMIT}
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* ═══ DELETE CONFIRMATION MODAL ═══ */}
            {confirmDelete && (
                <div
                    onClick={() => setConfirmDelete(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 100,
                        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'fadeIn 0.15s ease',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-card)', borderRadius: 20, padding: 32,
                            width: 400, maxWidth: '90vw', textAlign: 'center',
                            border: '2px solid var(--accent-red)',
                            boxShadow: '0 16px 48px rgba(239,68,68,0.12)',
                            animation: 'fadeIn 0.2s ease',
                        }}
                    >
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%',
                            background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}>
                            <AlertTriangle size={28} />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                            Delete Student?
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8, fontWeight: 500 }}>
                            This will permanently remove:
                        </p>
                        <div style={{
                            background: 'var(--bg-input)', borderRadius: 12, padding: 16,
                            textAlign: 'left', marginBottom: 20, fontSize: 13,
                        }}>
                            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>
                                {confirmDelete.name} ({confirmDelete.roll_no})
                            </div>
                            <div style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
                                • Student record from database<br />
                                • All face embeddings from FAISS index<br />
                                • All captured photos<br />
                                • All attendance records
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setConfirmDelete(null)}
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleDelete(confirmDelete.roll_no)}
                                disabled={deleting}
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
