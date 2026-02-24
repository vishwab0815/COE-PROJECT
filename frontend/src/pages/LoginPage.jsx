import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, KeyRound, AlertCircle, Scan } from 'lucide-react';

export default function LoginPage() {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [shake, setShake] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (login(pin)) {
            navigate('/', { replace: true });
        } else {
            setError('Incorrect PIN');
            setShake(true);
            setPin('');
            setTimeout(() => setShake(false), 500);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-primary)', backgroundImage: 'var(--gradient-mesh)',
            fontFamily: 'var(--font)', padding: 20,
        }}>
            <div style={{
                width: 400, maxWidth: '100%',
                background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px) saturate(180%)',
                borderRadius: 28, border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.06), 0 8px 20px rgba(0,0,0,0.03)',
                padding: '48px 40px', textAlign: 'center',
                animation: shake ? 'shakeX 0.4s ease' : 'fadeIn 0.4s ease',
            }}>
                {/* Icon */}
                <div style={{
                    width: 72, height: 72, borderRadius: 22, background: 'var(--gradient-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 24px', boxShadow: '0 8px 24px rgba(13,148,136,0.2)',
                }}>
                    <ShieldCheck size={32} color="white" />
                </div>

                <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', color: '#0c1222', marginBottom: 6 }}>
                    Attend-AI
                </h1>
                <p style={{ fontSize: 13, color: '#8896ab', fontWeight: 500, marginBottom: 32 }}>
                    Enter admin PIN to access the dashboard
                </p>

                <form onSubmit={handleSubmit}>
                    <div style={{ position: 'relative', marginBottom: 20 }}>
                        <KeyRound size={18} style={{
                            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                            color: '#8896ab',
                        }} />
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => { setPin(e.target.value); setError(''); }}
                            placeholder="Enter PIN"
                            autoFocus
                            style={{
                                width: '100%', padding: '14px 16px 14px 48px',
                                background: 'rgba(255,255,255,0.9)', border: `1.5px solid ${error ? 'var(--accent-red)' : 'rgba(0,0,0,0.06)'}`,
                                borderRadius: 14, fontSize: 16, fontFamily: 'var(--font)',
                                fontWeight: 700, letterSpacing: '0.15em', textAlign: 'center',
                                outline: 'none', transition: 'all 0.2s',
                                color: '#0c1222',
                            }}
                            onFocus={(e) => e.target.style.borderColor = error ? 'var(--accent-red)' : 'var(--accent-primary)'}
                            onBlur={(e) => e.target.style.borderColor = error ? 'var(--accent-red)' : 'rgba(0,0,0,0.06)'}
                        />
                    </div>

                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            color: 'var(--accent-red)', fontSize: 13, fontWeight: 600,
                            marginBottom: 16, animation: 'fadeIn 0.2s ease',
                        }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <button type="submit" style={{
                        width: '100%', padding: '14px 20px',
                        background: 'var(--gradient-primary)', color: 'white',
                        border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700,
                        fontFamily: 'var(--font)', cursor: 'pointer', letterSpacing: '-0.01em',
                        boxShadow: '0 4px 16px rgba(13,148,136,0.25)',
                        transition: 'all 0.2s',
                    }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(13,148,136,0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(13,148,136,0.25)'; }}
                    >
                        Unlock Admin
                    </button>
                </form>

                <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <button
                        onClick={() => navigate('/kiosk')}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            margin: '0 auto', fontSize: 13, fontWeight: 600,
                            color: '#8896ab', fontFamily: 'var(--font)', transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#8896ab'}
                    >
                        <Scan size={15} /> Open Kiosk Mode (Students)
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes shakeX {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-8px); }
                    40% { transform: translateX(8px); }
                    60% { transform: translateX(-6px); }
                    80% { transform: translateX(6px); }
                }
            `}</style>
        </div>
    );
}
