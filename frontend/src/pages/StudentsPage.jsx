import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Search, Users, Filter } from 'lucide-react';

export default function StudentsPage() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [branch, setBranch] = useState('');
    const [page, setPage] = useState(0);
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

    return (
        <>
            <div className="page-header">
                <h2>Students</h2>
                <p>Browse and search registered students</p>
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
                    </select>

                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                                No students found
                                            </td>
                                        </tr>
                                    ) : (
                                        students.map((s, i) => (
                                            <tr key={s.roll_no}>
                                                <td style={{ color: 'var(--text-muted)' }}>{page * LIMIT + i + 1}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.roll_no}</td>
                                                <td>{s.name}</td>
                                                <td><span className="badge branch">{s.branch}</span></td>
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
                    <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
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
        </>
    );
}
