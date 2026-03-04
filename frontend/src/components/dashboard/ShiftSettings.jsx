import { useState } from 'react';
import { Settings, CheckCircle, X } from 'lucide-react';
import CustomTimePicker from './CustomTimePicker';

export default function ShiftSettings({ shiftConfig, setShiftConfig, handleConfigSave }) {
    const [showSuccess, setShowSuccess] = useState(false);

    const onSave = async () => {
        await handleConfigSave();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
    };

    return (
        <>
            <div className="card fade-in" style={{ flex: '0 0 auto', padding: '16px 20px', overflow: 'visible' }}>
                <div className="card-header" style={{ marginBottom: 10, padding: 0 }}>
                    <span className="card-title" style={{ fontSize: 12 }}>Global Shift Thresholds</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
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
                <button className="btn btn-primary" style={{ marginTop: 12, width: '100%', display: 'flex', justifyContent: 'center', padding: '10px 16px', fontSize: 13 }} onClick={onSave}>
                    <Settings size={14} /> Apply Settings
                </button>
            </div>

            {/* Success Modal */}
            {showSuccess && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.3)',
                    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                    animation: 'fadeIn 0.2s ease-out',
                }}
                    onClick={() => setShowSuccess(false)}
                >
                    <div style={{
                        background: '#fff', borderRadius: 20, padding: '32px 40px',
                        textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
                        animation: 'fadeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        maxWidth: 320,
                    }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}>
                            <CheckCircle size={28} color="#10b981" />
                        </div>
                        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.02em' }}>
                            Settings Saved!
                        </h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.5 }}>
                            Shift thresholds have been updated successfully.
                        </p>
                        <button
                            onClick={() => setShowSuccess(false)}
                            style={{
                                marginTop: 18, padding: '9px 28px', borderRadius: 12,
                                background: 'var(--gradient-primary)', color: '#fff',
                                border: 'none', fontWeight: 700, fontSize: 13,
                                cursor: 'pointer', fontFamily: 'var(--font)',
                                boxShadow: '0 4px 14px rgba(13, 148, 136, 0.25)',
                                transition: 'all 0.2s',
                            }}
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
