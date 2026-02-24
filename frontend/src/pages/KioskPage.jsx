import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CheckCircle, XCircle, Scan, ShieldCheck, Users, Clock } from 'lucide-react';

const SCAN_INTERVAL = 3000;

export default function KioskPage() {
    const webcamRef = useRef(null);
    const [scanning, setScanning] = useState(true);
    const [results, setResults] = useState([]);
    const [facesDetected, setFacesDetected] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [scanCount, setScanCount] = useState(0);
    const navigate = useNavigate();
    const timerRef = useRef(null);
    const busyRef = useRef(false);

    const captureAndScan = useCallback(async () => {
        if (!webcamRef.current || !scanning || busyRef.current) return;
        const screenshot = webcamRef.current.getScreenshot();
        if (!screenshot) return;

        busyRef.current = true;
        try {
            const res = await fetch(screenshot);
            const blob = await res.blob();
            const data = await api.markAttendanceMulti(blob);
            setScanCount(c => c + 1);

            // No faces detected — keep scanning
            if (!data.success || data.faces_detected === 0) {
                busyRef.current = false;
                return;
            }

            // Got results — show them
            if (data.results && data.results.length > 0) {
                setResults(data.results);
                setFacesDetected(data.faces_detected);
                setShowResults(true);
                setScanning(false);
                setTimeout(() => {
                    setShowResults(false);
                    setResults([]);
                    setFacesDetected(0);
                    setScanning(true);
                    busyRef.current = false;
                }, 5000);
                return;
            }

            busyRef.current = false;
        } catch (err) {
            busyRef.current = false;
        }
    }, [scanning]);

    useEffect(() => {
        if (!scanning) return;
        timerRef.current = setInterval(captureAndScan, SCAN_INTERVAL);
        return () => clearInterval(timerRef.current);
    }, [scanning, captureAndScan]);

    const newlyMarked = results.filter(r => r.status === 'Present').length;
    const alreadyMarked = results.filter(r => r.status === 'Already Marked').length;

    return (
        <div style={{
            height: '100vh', width: '100vw', position: 'relative',
            background: '#0c1222', overflow: 'hidden', fontFamily: 'var(--font)',
        }}>
            {/* Full-screen camera */}
            <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.92}
                videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />

            {/* Center face guide */}
            <div style={{
                position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%,-50%)',
                width: 240, height: 300,
                border: showResults ? '3px solid rgba(16,185,129,0.8)' : '2px solid rgba(13,148,136,0.3)',
                borderRadius: 30, pointerEvents: 'none', transition: 'all 0.4s',
                boxShadow: showResults
                    ? '0 0 60px rgba(16,185,129,0.15), inset 0 0 40px rgba(16,185,129,0.05)'
                    : '0 0 40px rgba(13,148,136,0.05)',
            }}>
                {[
                    { top: -6, left: -6, bt: '3px solid var(--accent-primary)', bl: '3px solid var(--accent-primary)', br: '10px 0 0 0' },
                    { top: -6, right: -6, bt: '3px solid var(--accent-primary)', borderRight: '3px solid var(--accent-primary)', br: '0 10px 0 0' },
                    { bottom: -6, left: -6, bb: '3px solid var(--accent-primary)', bl: '3px solid var(--accent-primary)', br: '0 0 0 10px' },
                    { bottom: -6, right: -6, bb: '3px solid var(--accent-primary)', borderRight: '3px solid var(--accent-primary)', br: '0 0 10px 0' },
                ].map((s, i) => (
                    <div key={i} style={{
                        position: 'absolute', width: 24, height: 24,
                        top: s.top, left: s.left, right: s.right, bottom: s.bottom,
                        borderTop: s.bt, borderLeft: s.bl, borderBottom: s.bb, borderRight: s.borderRight,
                        borderRadius: s.br,
                    }} />
                ))}
            </div>

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
                            width: 8, height: 8, borderRadius: '50%', background: scanning ? '#10b981' : '#8896ab',
                            boxShadow: scanning ? '0 0 8px rgba(16,185,129,0.5)' : 'none',
                            animation: scanning ? 'breathe 2s ease-in-out infinite' : 'none',
                        }} />
                        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
                            {scanning ? 'Scanning...' : `${results.length} recognized`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom instruction */}
            {!showResults && (
                <div style={{
                    position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                    padding: '14px 28px', background: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(16px)', borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.08)', animation: 'fadeIn 0.3s ease',
                }}>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center', letterSpacing: '-0.01em' }}>
                        Multi-face detection active — up to 70 faces
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500, textAlign: 'center', marginTop: 4 }}>
                        Auto-scanning every 3 seconds
                    </div>
                </div>
            )}

            {/* ═══ MULTI-FACE RESULTS OVERLAY ═══ */}
            {showResults && results.length > 0 && (
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.6), transparent)',
                    padding: '60px 28px 28px',
                    animation: 'fadeIn 0.3s ease',
                }}>
                    {/* Summary bar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
                        marginBottom: 16,
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 18px', background: 'rgba(16,185,129,0.15)',
                            borderRadius: 100, border: '1px solid rgba(16,185,129,0.2)',
                        }}>
                            <Users size={15} color="#10b981" />
                            <span style={{ color: '#10b981', fontSize: 14, fontWeight: 800 }}>
                                {facesDetected} faces detected
                            </span>
                        </div>
                        {newlyMarked > 0 && (
                            <div style={{
                                padding: '8px 18px', background: 'rgba(16,185,129,0.15)',
                                borderRadius: 100, border: '1px solid rgba(16,185,129,0.2)',
                                color: '#10b981', fontSize: 13, fontWeight: 700,
                            }}>
                                ✓ {newlyMarked} marked
                            </div>
                        )}
                        {alreadyMarked > 0 && (
                            <div style={{
                                padding: '8px 18px', background: 'rgba(14,165,233,0.12)',
                                borderRadius: 100, border: '1px solid rgba(14,165,233,0.2)',
                                color: '#0ea5e9', fontSize: 13, fontWeight: 700,
                            }}>
                                ↻ {alreadyMarked} already marked
                            </div>
                        )}
                    </div>

                    {/* Student cards grid */}
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center',
                        maxHeight: 280, overflowY: 'auto', paddingBottom: 8,
                    }}>
                        {results.map((r, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 18px', minWidth: 220,
                                background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)',
                                borderRadius: 16,
                                border: `1.5px solid ${r.status === 'Present' ? 'rgba(16,185,129,0.4)' : 'rgba(14,165,233,0.3)'}`,
                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
                            }}>
                                {/* Avatar circle */}
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                    background: r.status === 'Present'
                                        ? 'linear-gradient(135deg, #10b981, #0d9488)'
                                        : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: 15, fontWeight: 800,
                                }}>
                                    {r.name?.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 14, fontWeight: 800, color: '#0c1222',
                                        letterSpacing: '-0.02em', whiteSpace: 'nowrap',
                                        overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {r.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                        {r.roll_no} • {r.branch}
                                    </div>
                                </div>
                                {/* Status icon */}
                                <div style={{ flexShrink: 0 }}>
                                    {r.status === 'Present'
                                        ? <CheckCircle size={18} color="#10b981" />
                                        : <CheckCircle size={18} color="#0ea5e9" />
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
