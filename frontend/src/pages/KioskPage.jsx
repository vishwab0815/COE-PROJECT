import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CheckCircle, XCircle, Scan, ShieldCheck, Wifi } from 'lucide-react';

const SCAN_INTERVAL = 3000;

export default function KioskPage() {
    const webcamRef = useRef(null);
    const [scanning, setScanning] = useState(true);
    const [result, setResult] = useState(null);
    const [showResult, setShowResult] = useState(false);
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
            const data = await api.markAttendance(blob);

            // Skip if no face detected or not recognized
            if (data.status === 'No Face Detected' || !data.success) {
                busyRef.current = false;
                return;
            }

            // Successful recognition
            if (data.success && data.status === 'Present') {
                setResult({ success: true, name: data.name, roll_no: data.roll_no, branch: data.branch });
                setShowResult(true);
                setScanning(false);
                setTimeout(() => {
                    setShowResult(false);
                    setResult(null);
                    setScanning(true);
                    busyRef.current = false;
                }, 4000);
                return;
            }

            // Already marked today
            if (data.status === 'Already Marked') {
                setResult({ success: true, name: data.name, roll_no: data.roll_no, branch: data.branch, already: true });
                setShowResult(true);
                setScanning(false);
                setTimeout(() => {
                    setShowResult(false);
                    setResult(null);
                    setScanning(true);
                    busyRef.current = false;
                }, 3000);
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
                style={{
                    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                }}
            />

            {/* Face guide overlay */}
            <div style={{
                position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%,-50%)',
                width: 240, height: 300, border: showResult && result?.success
                    ? '3px solid rgba(16,185,129,0.8)'
                    : '2px solid rgba(13,148,136,0.3)',
                borderRadius: 30, pointerEvents: 'none',
                transition: 'all 0.4s',
                boxShadow: showResult && result?.success
                    ? '0 0 60px rgba(16,185,129,0.15), inset 0 0 40px rgba(16,185,129,0.05)'
                    : '0 0 40px rgba(13,148,136,0.05)',
            }}>
                {/* Corner brackets */}
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

            {/* Top bar — branding + status */}
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
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500 }}>Kiosk Mode</div>
                    </div>
                </div>

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
                        {scanning ? 'Scanning...' : 'Paused'}
                    </span>
                </div>
            </div>

            {/* Bottom instruction */}
            {!showResult && (
                <div style={{
                    position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                    padding: '14px 28px', background: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(16px)', borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.08)',
                    animation: 'fadeIn 0.3s ease',
                }}>
                    <div style={{
                        color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center',
                        letterSpacing: '-0.01em',
                    }}>
                        Look at the camera to mark attendance
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500, textAlign: 'center', marginTop: 4 }}>
                        Auto-scanning every 3 seconds
                    </div>
                </div>
            )}

            {/* Result overlay */}
            {showResult && result && (
                <div style={{
                    position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
                    width: 420, maxWidth: '90vw',
                    background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(24px)',
                    borderRadius: 24, padding: '32px 28px',
                    border: `2px solid ${result.success ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                    boxShadow: result.success
                        ? '0 20px 60px rgba(16,185,129,0.15)'
                        : '0 20px 60px rgba(239,68,68,0.15)',
                    textAlign: 'center',
                    animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
                    zIndex: 50,
                }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: result.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                    }}>
                        {result.success ? <CheckCircle size={32} color="var(--accent-green)" /> : <XCircle size={32} color="var(--accent-red)" />}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#0c1222', letterSpacing: '-0.03em', marginBottom: 4 }}>
                        {result.name}
                    </div>
                    <div style={{ fontSize: 14, color: '#3e4c63', fontWeight: 600, marginBottom: 16 }}>
                        {result.roll_no} • {result.branch}
                    </div>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 16px', borderRadius: 100,
                        background: result.already ? 'rgba(14,165,233,0.08)' : 'rgba(16,185,129,0.08)',
                        color: result.already ? 'var(--accent-blue)' : 'var(--accent-green)',
                        fontSize: 13, fontWeight: 700,
                    }}>
                        <CheckCircle size={14} /> {result.already ? 'Already Marked Today' : 'Attendance Marked'}
                    </div>
                </div>
            )}

            {/* Admin exit button (bottom-right corner) */}
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
