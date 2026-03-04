import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Scan, Clock } from 'lucide-react';
import { api } from '../services/api';

export default function KioskPage() {
    const navigate = useNavigate();
    const [streamUrl, setStreamUrl] = useState('');
    const [scanCount, setScanCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        // Ensure backend stream is not paused from the registration page
        api.resumeStream()
            .catch(err => console.log('Failed to resume stream', err))
            .finally(() => {
                // Bypass browser caching to force a fresh MJPEG stream pipeline
                const baseUrl = import.meta.env.VITE_API_URL || '/api';
                setStreamUrl(`${baseUrl}/video-feed?t=${Date.now()}`);
            });

        // Setup live polling for recent attendance marks
        let lastCheck = Date.now() / 1000;
        const pollInterval = setInterval(async () => {
            try {
                const data = await api.getRecentMarked();

                if (data.recent && Array.isArray(data.recent)) {
                    // Filter marks that are completely brand new
                    const newMarks = data.recent.filter(mark => mark.timestamp > lastCheck);

                    if (newMarks.length > 0) {
                        lastCheck = Math.max(...newMarks.map(m => m.timestamp));
                        setScanCount(prev => prev + newMarks.length);

                        const newToasts = newMarks.map(m => ({
                            id: Math.random().toString(),
                            message: `${m.name} Marked Successfully`,
                        }));

                        setToasts(prev => [...prev, ...newToasts]);

                        // Auto-dismiss toasts after 4 seconds
                        newToasts.forEach(t => {
                            setTimeout(() => {
                                setToasts(prev => prev.filter(pt => pt.id !== t.id));
                            }, 4000);
                        });
                    }
                }
            } catch (err) {
                // Ignore silent polling network errors
            }
        }, 1500);

        return () => {
            clearInterval(pollInterval);
            // MUST release hardware camera when component unmounts to prevent locking
            // Utilize sendBeacon because browser unmounts often cancel standard async fetches
            const baseUrl = import.meta.env.VITE_API_URL || '/api';
            navigator.sendBeacon(`${baseUrl}/stream/pause`);
        };
    }, []);

    return (
        <div style={{
            height: '100vh', width: '100vw', position: 'relative',
            background: '#0c1222', overflow: 'hidden', fontFamily: 'var(--font)',
        }}>
            {isLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0c1222', zIndex: 10 }}>
                    <div className="spinner" style={{ width: 44, height: 44, borderWidth: 4, marginBottom: 20, borderColor: 'var(--accent-primary) transparent transparent transparent' }}></div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>ACQUIRING HARDWARE LINK...</span>
                </div>
            )}

            {/* Live Toast Notifications */}
            <div style={{
                position: 'absolute', top: 100, right: 32,
                display: 'flex', flexDirection: 'column', gap: 12, zIndex: 100
            }}>
                {toasts.map(toast => (
                    <div key={toast.id} style={{
                        padding: '16px 20px', background: 'rgba(16, 185, 129, 0.85)',
                        backdropFilter: 'blur(8px)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14,
                        boxShadow: '0 8px 32px rgba(16, 185, 129, 0.25)', border: '1px solid rgba(255, 255, 255, 0.2)',
                        animation: 'fadeIn 0.3s ease'
                    }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 50 }}>
                            <ShieldCheck size={18} color="white" />
                        </div>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Full-screen camera stream from backend */}
            <img
                src={streamUrl}
                alt="Live Camera Feed"
                onLoad={() => setIsLoading(false)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: streamUrl ? 'block' : 'none' }}
            />

            {/* Top bar */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 28px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 14,
                        background: 'var(--gradient-primary)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(13,148,136,0.3)',
                    }}>
                        <Scan size={20} color="white" />
                    </div>
                    <div>
                        <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em' }}>Attend-AI</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500 }}>Multi-Face Kiosk</div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Scan count */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', background: 'rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(12px)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <Clock size={13} color="rgba(255,255,255,0.5)" />
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600 }}>{scanCount} scans</span>
                    </div>

                    {/* Status */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px', background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(12px)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%', background: '#10b981',
                            boxShadow: '0 0 8px rgba(16,185,129,0.5)',
                            animation: 'breathe 2s ease-in-out infinite',
                        }} />
                        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
                            Live Stream Active
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom instruction */}
            <div style={{
                position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                padding: '14px 28px', background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(16px)', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.08)', animation: 'fadeIn 0.3s ease',
            }}>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center', letterSpacing: '-0.01em' }}>
                    Multi-face detection active — tracking up to 70 faces
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500, textAlign: 'center', marginTop: 4 }}>
                    Live RTSP Feed • YOLO-Face + ByteTrack
                </div>
            </div>

            {/* Admin exit button */}
            <button
                onClick={() => navigate('/login')}
                style={{
                    position: 'absolute', bottom: 20, right: 20, zIndex: 60,
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', background: 'rgba(0,0,0,0.35)',
                    backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(0,0,0,0.5)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'rgba(0,0,0,0.35)'; }}
            >
                <ShieldCheck size={13} /> Admin
            </button>
        </div>
    );
}
