import { useState, useEffect } from 'react';
import { ShieldCheck, Video } from 'lucide-react';

export default function CameraPage() {
    const [streamUrl, setStreamUrl] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        // Ensure backend stream is not paused from the registration page
        fetch('http://localhost:8000/stream/resume', { method: 'POST' })
            .catch(err => console.log('Failed to resume stream', err))
            .finally(() => {
                // Bypass browser caching to force a fresh MJPEG stream pipeline
                setStreamUrl(`http://localhost:8000/video-feed?t=${Date.now()}`);
            });

        // Setup live polling for recent attendance marks
        let lastCheck = Date.now() / 1000;
        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch('http://localhost:8000/recent-marked');
                const data = await res.json();

                if (data.recent && Array.isArray(data.recent)) {
                    // Filter marks that are completely brand new
                    const newMarks = data.recent.filter(mark => mark.timestamp > lastCheck);

                    if (newMarks.length > 0) {
                        lastCheck = Math.max(...newMarks.map(m => m.timestamp));

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
            // GUARANTEE: Free the hardware backend OpenCV camera when leaving the route
            const baseUrl = import.meta.env.VITE_API_URL || '/api';
            navigator.sendBeacon(`${baseUrl}/stream/pause`);
        };
    }, []);

    return (
        <>
            <div className="page-header" style={{ padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <h2 style={{ fontSize: 18 }}>CCTV Live View</h2>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 14px', borderRadius: 100,
                        background: 'rgba(16,185,129,0.1)', color: 'var(--accent-green)',
                        fontSize: 12, fontWeight: 700, animation: 'pulse 2s ease-in-out infinite',
                    }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-green)' }} />
                        ENGAGED
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldCheck size={16} /> Auto-Marking Active
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', background: '#f1f5f9', padding: 24 }}>
                <div style={{
                    position: 'relative', width: '100%', height: '100%',
                    maxWidth: 1080, margin: '0 auto',
                    borderRadius: 24, overflow: 'hidden',
                    boxShadow: '0 12px 48px rgba(0,0,0,0.1)',
                    background: '#0c1222', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    {isLoading && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0c1222', zIndex: 10 }}>
                            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, marginBottom: 16, borderColor: 'var(--accent-primary) transparent transparent transparent' }}></div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Acquiring Hardware Link...</span>
                        </div>
                    )}

                    {/* Live Toast Notifications */}
                    <div style={{
                        position: 'absolute', top: 20, right: 20,
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

                    <img
                        src={streamUrl}
                        alt="CCTV Feed"
                        onLoad={() => setIsLoading(false)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: streamUrl ? 'block' : 'none' }}
                    />

                    <div style={{
                        position: 'absolute', bottom: 20, left: 20,
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
                        padding: '10px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <Video size={16} color="white" />
                        <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>YOLO-Face + ByteTrack</span>
                    </div>
                </div>
            </div>
        </>
    );
}
