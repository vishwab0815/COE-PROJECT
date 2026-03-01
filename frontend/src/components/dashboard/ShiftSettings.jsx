import { Settings } from 'lucide-react';
import CustomTimePicker from './CustomTimePicker';

export default function ShiftSettings({ shiftConfig, setShiftConfig, handleConfigSave }) {
    return (
        <div className="card fade-in" style={{ flex: '0 0 auto' }}>
            <div className="card-header">
                <span className="card-title">Global Shift Thresholds</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
                <CustomTimePicker
                    label="Login Limit (IN)"
                    value={shiftConfig.login_time}
                    onChange={(time) => setShiftConfig({ ...shiftConfig, login_time: time })}
                />

                <CustomTimePicker
                    label="Logout Limit (OUT)"
                    value={shiftConfig.logout_time}
                    onChange={(time) => setShiftConfig({ ...shiftConfig, logout_time: time })}
                />
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16, width: '100%', display: 'flex', justifyContent: 'center' }} onClick={handleConfigSave}>
                <Settings size={16} /> Apply Settings
            </button>
        </div>
    );
}
