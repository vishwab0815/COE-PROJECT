import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { api } from '../services/api';
import { UserPlus, Camera, CheckCircle, XCircle, RotateCcw, LayoutDashboard } from 'lucide-react';

const TOTAL_CAPTURES = 15;
const CAPTURE_INTERVAL_MS = 300;

export default function RegisterPage() {
    const navigate = useNavigate();
    const webcamRef = useRef(null);

    const [rollNo, setRollNo] = useState('');
    const [name, setName] = useState('');
    const [branch, setBranch] = useState('CSE');
    const [phase, setPhase] = useState('form');
    const [countdown, setCountdown] = useState(3);
    const [capturedCount, setCapturedCount] = useState(0);
    const [capturedImages, setCapturedImages] = useState([]);
    const [result, setResult] = useState(null);
    const [cameraReady, setCameraReady] = useState(false);

    // Grab exclusive access to the camera by pausing the backend stream
    useEffect(() => {
        let isMounted = true;
        api.pauseStream()
            .then(() => { if (isMounted) setCameraReady(true); })
            .catch(err => {
                console.log('Failed to pause background stream', err);
                // Fallback to true in case the backend is down so the UI doesn't hang indefinitely
                if (isMounted) setCameraReady(true);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const startCapture = () => {
        if (!rollNo.trim() || !name.trim()) return;
        setPhase('countdown'); setCountdown(3); setCapturedCount(0); setCapturedImages([]); setResult(null);
    };

    useEffect(() => {
        if (phase !== 'countdown') return;
        if (countdown <= 0) { setPhase('capturing'); return; }
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [phase, countdown]);



    useEffect(() => {
        if (phase !== 'capturing') return;
        let count = 0; const images = [];
        const captureLoop = setInterval(() => {
            if (!webcamRef.current || count >= TOTAL_CAPTURES) { clearInterval(captureLoop); setCapturedImages(images); setPhase('processing'); return; }
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) { images.push(imageSrc); count++; setCapturedCount(count); }
        }, CAPTURE_INTERVAL_MS);
        return () => clearInterval(captureLoop);
    }, [phase]);

    useEffect(() => {
        if (phase !== 'processing' || capturedImages.length === 0) return;
        const processImages = async () => {
            try {
                const blobs = await Promise.all(capturedImages.map(async (src) => { const res = await fetch(src); return res.blob(); }));
                const data = await api.registerWithFace({ roll_no: rollNo.toUpperCase(), name, branch }, blobs);
                setResult(data); setPhase(data.success ? 'done' : 'error');
            } catch (err) { setResult({ success: false, message: err.message }); setPhase('error'); }
        };
        processImages();
    }, [phase, capturedImages]);

    const reset = () => { setPhase('form'); setRollNo(''); setName(''); setBranch('CSE'); setCapturedCount(0); setCapturedImages([]); setResult(null); setCountdown(3); };

    return (
        <>
            <div className="page-header" style={{ padding: '14px 32px' }}>
                <h2 style={{ fontSize: 18 }}>Register New Student</h2>
                <p>Fill in details → Face capture → Instant enrollment</p>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                <div style={{ flex: 1, position: 'relative', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                        {cameraReady ? (
                            <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" screenshotQuality={0.92}
                                videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0' }}>
                                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, marginBottom: 16, borderColor: 'var(--accent-primary) transparent transparent transparent' }}></div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Acquiring Camera...</span>
                            </div>
                        )}

                        {/* Face guide */}
                        <div style={{
                            position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: 200, height: 260,
                            border: phase === 'capturing' ? '3px solid var(--accent-green)' : '2px dashed rgba(13,148,136,0.25)',
                            borderRadius: 24, pointerEvents: 'none', transition: 'all 0.3s',
                            boxShadow: phase === 'capturing' ? '0 0 30px rgba(16,185,129,0.2)' : 'none',
                        }}>
                            <div style={{ position: 'absolute', top: -6, left: -6, width: 18, height: 18, borderTop: '3px solid var(--accent-primary)', borderLeft: '3px solid var(--accent-primary)', borderRadius: '8px 0 0 0' }} />
                            <div style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderTop: '3px solid var(--accent-primary)', borderRight: '3px solid var(--accent-primary)', borderRadius: '0 8px 0 0' }} />
                            <div style={{ position: 'absolute', bottom: -6, left: -6, width: 18, height: 18, borderBottom: '3px solid var(--accent-primary)', borderLeft: '3px solid var(--accent-primary)', borderRadius: '0 0 0 8px' }} />
                            <div style={{ position: 'absolute', bottom: -6, right: -6, width: 18, height: 18, borderBottom: '3px solid var(--accent-primary)', borderRight: '3px solid var(--accent-primary)', borderRadius: '0 0 8px 0' }} />
                        </div>

                        {/* ═══ COUNTDOWN ═══ */}
                        {phase === 'countdown' && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                                <div style={{ fontSize: 120, fontWeight: 900, color: 'var(--accent-primary)', textShadow: '0 0 40px rgba(13,148,136,0.3)', animation: 'pulse 1s ease-in-out' }}>{countdown}</div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 16, fontWeight: 600 }}>Get ready — look straight at the camera</p>
                            </div>
                        )}

                        {/* ═══ CAPTURING ═══ */}
                        {phase === 'capturing' && (
                            <div style={{ position: 'absolute', inset: 0, border: '4px solid var(--accent-green)', pointerEvents: 'none', zIndex: 20, animation: 'pulse 0.3s ease-in-out infinite' }}>
                                <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', padding: '10px 24px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                                    <Camera size={18} style={{ color: 'var(--accent-green)' }} />
                                    <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 14, letterSpacing: '-0.01em' }}>Capturing... {capturedCount}/{TOTAL_CAPTURES}</span>
                                </div>
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, background: 'rgba(0,0,0,0.05)' }}>
                                    <div style={{ height: '100%', background: 'var(--accent-green)', width: `${(capturedCount / TOTAL_CAPTURES) * 100}%`, transition: 'width 0.2s', borderRadius: 3 }} />
                                </div>
                            </div>
                        )}

                        {/* ═══ PROCESSING ═══ */}
                        {phase === 'processing' && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                                <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4, marginBottom: 20 }} />
                                <h3 style={{ fontSize: 18, marginBottom: 8, fontWeight: 800, letterSpacing: '-0.02em' }}>Processing on GPU...</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>Extracting face embeddings from {capturedImages.length} images</p>
                            </div>
                        )}

                        {/* ═══ SUCCESS ═══ */}
                        {phase === 'done' && result && (
                            <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ background: 'var(--bg-card)', border: '2px solid var(--accent-green)', borderRadius: 24, padding: 36, width: 420, maxWidth: '90vw', textAlign: 'center', boxShadow: '0 12px 48px rgba(16,185,129,0.12)', animation: 'fadeIn 0.25s ease' }}>
                                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><CheckCircle size={36} /></div>
                                    <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em' }}>Registration Successful!</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, fontWeight: 500 }}>{result.name} is now enrolled and can be recognized</p>
                                    <div style={{ background: 'var(--bg-input)', borderRadius: 14, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, textAlign: 'left', marginBottom: 24 }}>
                                        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Roll No</div><div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{result.roll_no}</div></div>
                                        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Name</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{result.name}</div></div>
                                        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Branch</div><div style={{ marginTop: 6 }}><span className="badge branch">{result.branch}</span></div></div>
                                        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Embeddings</div><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-green)', marginTop: 4 }}>{result.embeddings_added} / {result.total_images}</div></div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <button className="btn btn-outline" onClick={reset} style={{ flex: 1, justifyContent: 'center' }}><UserPlus size={16} /> Register Another</button>
                                        <button className="btn btn-primary" onClick={() => navigate('/')} style={{ flex: 1, justifyContent: 'center' }}><LayoutDashboard size={16} /> Dashboard</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ ERROR ═══ */}
                        {phase === 'error' && result && (
                            <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ background: 'var(--bg-card)', border: '2px solid var(--accent-red)', borderRadius: 24, padding: 36, width: 400, maxWidth: '90vw', textAlign: 'center', animation: 'fadeIn 0.25s ease' }}>
                                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><XCircle size={36} /></div>
                                    <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em' }}>Registration Failed</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, fontWeight: 500 }}>{result.message || result.error || 'Unknown error'}</p>
                                    <button className="btn btn-outline" onClick={reset} style={{ width: '100%', justifyContent: 'center' }}><RotateCcw size={16} /> Try Again</button>
                                </div>
                            </div>
                        )}

                        {/* ═══ FORM PANEL — Fixed Bottom Card ═══ */}
                        {phase === 'form' && (
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
                                background: 'rgba(255,255,255,0.97)',
                                backdropFilter: 'blur(20px)',
                                borderTop: '1px solid var(--border-color)',
                                boxShadow: '0 -8px 32px rgba(0,0,0,0.06)',
                                padding: '24px 32px 28px',
                            }}>
                                <div style={{ maxWidth: 720, margin: '0 auto' }}>
                                    {/* Row of inputs */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr 0.8fr auto', gap: 16, alignItems: 'end' }}>
                                        {/* Roll Number */}
                                        <div>
                                            <label style={{
                                                display: 'block', fontSize: 12, fontWeight: 700,
                                                color: 'var(--text-secondary)', letterSpacing: '0.03em',
                                                marginBottom: 8,
                                            }}>
                                                Roll Number <span style={{ color: 'var(--accent-red)' }}>*</span>
                                            </label>
                                            <input
                                                className="input"
                                                placeholder="1RV22CSE001"
                                                value={rollNo}
                                                onChange={(e) => setRollNo(e.target.value.toUpperCase())}
                                                style={{
                                                    height: 44, fontSize: 14, fontWeight: 600,
                                                    background: '#fff',
                                                    borderColor: 'var(--border-color)',
                                                    letterSpacing: '0.02em',
                                                }}
                                            />
                                        </div>

                                        {/* Full Name */}
                                        <div>
                                            <label style={{
                                                display: 'block', fontSize: 12, fontWeight: 700,
                                                color: 'var(--text-secondary)', letterSpacing: '0.03em',
                                                marginBottom: 8,
                                            }}>
                                                Full Name <span style={{ color: 'var(--accent-red)' }}>*</span>
                                            </label>
                                            <input
                                                className="input"
                                                placeholder="Rahul Kumar"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                style={{
                                                    height: 44, fontSize: 14, fontWeight: 600,
                                                    background: '#fff',
                                                    borderColor: 'var(--border-color)',
                                                }}
                                            />
                                        </div>

                                        {/* Branch */}
                                        <div>
                                            <label style={{
                                                display: 'block', fontSize: 12, fontWeight: 700,
                                                color: 'var(--text-secondary)', letterSpacing: '0.03em',
                                                marginBottom: 8,
                                            }}>
                                                Branch
                                            </label>
                                            <select
                                                className="select"
                                                value={branch}
                                                onChange={(e) => setBranch(e.target.value)}
                                                style={{
                                                    height: 44, fontSize: 14, fontWeight: 600,
                                                    background: '#fff',
                                                    borderColor: 'var(--border-color)',
                                                }}
                                            >
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
                                        </div>

                                        {/* Button */}
                                        <button
                                            className="btn btn-success"
                                            onClick={startCapture}
                                            disabled={!rollNo.trim() || !name.trim()}
                                            style={{
                                                height: 44,
                                                whiteSpace: 'nowrap',
                                                fontSize: 14,
                                                fontWeight: 700,
                                                padding: '0 24px',
                                                borderRadius: 12,
                                                letterSpacing: '-0.01em',
                                            }}
                                        >
                                            <Camera size={16} /> Start Capture
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
