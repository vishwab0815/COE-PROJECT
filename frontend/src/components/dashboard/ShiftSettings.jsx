import { Settings } from 'lucide-react';

export default function ShiftSettings({ shiftConfig, setShiftConfig, handleConfigSave }) {
    return (
        <div className="card fade-in" style={{ flex: '0 0 auto' }}>
            <div className="card-header">
                <span className="card-title">Global Shift Thresholds</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Login Limit (IN)</label>
                    <input
                        type="time"
                        className="form-input"
                        style={{ width: '100%' }}
                        value={shiftConfig.login_time}
                        onChange={e => setShiftConfig({ ...shiftConfig, login_time: e.target.value })}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>Logout Limit (OUT)</label>
                    <input
                        type="time"
                        className="form-input"
                        style={{ width: '100%' }}
                        value={shiftConfig.logout_time}
                        onChange={e => setShiftConfig({ ...shiftConfig, logout_time: e.target.value })}
                    />
                </div>
            </div>
            <button className="primary-btn" style={{ marginTop: 16, width: '100%', display: 'flex', justifyContent: 'center' }} onClick={handleConfigSave}>
                <Settings size={16} /> Apply Settings
            </button>
        </div>
    );
}
