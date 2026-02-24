import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Download, Search } from 'lucide-react';
import DatePicker from '../components/DatePicker';

export default function AttendancePage() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [branch, setBranch] = useState('');
    const [rollSearch, setRollSearch] = useState('');

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const params = { limit: 200 };
            if (date) params.date = date;
            if (branch) params.branch = branch;
            if (rollSearch) params.roll_no = rollSearch;
            const data = await api.getAttendanceReport(params);
            setRecords(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
        const interval = setInterval(fetchRecords, 15000);
        return () => clearInterval(interval);
    }, [date, branch, rollSearch]);

    const handleExport = () => {
        const params = {};
        if (date) params.date = date;
        if (branch) params.branch = branch;
        api.exportCSV(params);
    };

    return (
        <>
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2>Attendance Logs</h2>
                    <p>View and export attendance records</p>
                </div>
                <button className="btn btn-success" onClick={handleExport}>
                    <Download size={16} /> Export CSV
                </button>
            </div>

            <div className="page-body">
                {/* Filters */}
                <div className="filter-bar fade-in">
                    <DatePicker value={date} onChange={setDate} />

                    <select
                        className="select"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
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

                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            className="input"
                            placeholder="Filter by Roll No..."
                            value={rollSearch}
                            onChange={(e) => setRollSearch(e.target.value.toUpperCase())}
                            style={{ paddingLeft: 36, maxWidth: 220 }}
                        />
                    </div>

                    <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {records.length} records
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
                                        <th>Roll No</th>
                                        <th>Name</th>
                                        <th>Branch</th>
                                        <th>Date</th>
                                        <th>Time</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                                No attendance records found
                                            </td>
                                        </tr>
                                    ) : (
                                        records.map((r, i) => (
                                            <tr key={i}>
                                                <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.roll_no}</td>
                                                <td>{r.name}</td>
                                                <td><span className="badge branch">{r.branch}</span></td>
                                                <td>{r.date}</td>
                                                <td style={{ fontFamily: 'monospace' }}>{r.time}</td>
                                                <td><span className="badge present">{r.status}</span></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
