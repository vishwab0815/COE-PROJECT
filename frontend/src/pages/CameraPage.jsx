import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { api } from '../services/api';
import { Camera, Play, Square, Settings, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export default function CameraPage() {
    const webcamRef = useRef(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [showModal, setShowModal] = useState(false);

    const [autoMode, setAutoMode] = useState(false);
    const [interval, setIntervalTime] = useState(3);
    const autoRef = useRef(null);
    const [scanCount, setScanCount] = useState(0);
    const modalTimerRef = useRef(null);

    const capture = useCallback(async () => {
        if (!webcamRef.current || loading || showModal) return;
        setLoading(true);
        try {
            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) throw new Error('Failed to capture image');
            const res = await fetch(imageSrc);
            const blob = await res.blob();
            const data = await api.markAttendance(blob);
            setScanCount(c => c + 1);
            if (autoMode && data.status === 'No Face Detected') { setLoading(false); return; }
            setResult(data);
            setShowModal(true);
            if (data.success && data.status === 'Present') {
                setHistory(prev => [{ ...data, timestamp: new Date().toLocaleTimeString() }, ...prev].slice(0, 30));
            }
            modalTimerRef.current = setTimeout(() => { setShowModal(false); setResult(null); }, 3500);
        } catch (err) {
            setResult({ success: false, status: 'Error', message: err.message });
            setShowModal(true);
            modalTimerRef.current = setTimeout(() => { setShowModal(false); setResult(null); }, 3000);
        } finally { setLoading(false); }
    }, [loading, showModal, autoMode]);

    useEffect(() => {
        if (autoMode && !showModal) { autoRef.current = setInterval(capture, interval * 1000); }
        return () => { if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null; } };
    }, [autoMode, interval, capture, showModal]);

    const toggleAuto = () => { setAutoMode(prev => !prev); if (!autoMode) setScanCount(0); };
    const dismissModal = () => { if (modalTimerRef.current) clearTimeout(modalTimerRef.current); setShowModal(false); setResult(null); };

    return (
        <>
            <div className="page-header" style={{ padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <h2 style={{ fontSize: 18 }}>Mark Attendance</h2>
                    {autoMode && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '5px 14px', borderRadius: 100,
                            background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)',
                            fontSize: 12, fontWeight: 700, animation: 'pulse 1.5s ease-in-out infinite',
                        }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-red)' }} />
                            LIVE — {scanCount} scans
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Settings size={13} style={{ color: 'var(--text-muted)' }} />
                        <select className="select" value={interval} onChange={(e) => setIntervalTime(Number(e.target.value))}
                            style={{ width: 68, padding: '5px 8px', fontSize: 12 }}>
                            <option value={2}>2s</option><option value={3}>3s</option><option value={5}>5s</option><option value={10}>10s</option>
                        </select>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={capture} disabled={loading || showModal}><Camera size={14} /></button>
                    <button className={`btn btn-sm ${autoMode ? 'btn-danger' : 'btn-success'}`} onClick={toggleAuto}>
                        {autoMode ? <><Square size={14} /> Stop</> : <><Play size={14} /> Auto-Scan</>}
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                <div style={{ flex: 1, position: 'relative', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Camera with rounded container */}
                    <div style={{
                        position: 'relative', width: '100%', height: '100%',
                        maxWidth: 960, margin: '0 auto',
                        borderRadius: 0, overflow: 'hidden',
                    }}>
                        <Webcam
                            ref={webcamRef} audio={false}
                            screenshotFormat="image/jpeg" screenshotQuality={0.9}
                            videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />

                        {/* Scan overlay */}
                        {loading && (
                            <div style={{ position: 'absolute', inset: 0, border: '3px solid var(--accent-primary)', borderRadius: 'inherit', pointerEvents: 'none', animation: 'pulse 0.6s ease-in-out' }} />
                        )}

                        {/* Face guide */}
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: 180, height: 230, border: '2px dashed rgba(13,148,136,0.3)',
                            borderRadius: 24, pointerEvents: 'none',
                        }}>
                            <div style={{ position: 'absolute', top: -6, left: -6, width: 16, height: 16, borderTop: '3px solid var(--accent-primary)', borderLeft: '3px solid var(--accent-primary)', borderRadius: '6px 0 0 0' }} />
                            <div style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderTop: '3px solid var(--accent-primary)', borderRight: '3px solid var(--accent-primary)', borderRadius: '0 6px 0 0' }} />
                            <div style={{ position: 'absolute', bottom: -6, left: -6, width: 16, height: 16, borderBottom: '3px solid var(--accent-primary)', borderLeft: '3px solid var(--accent-primary)', borderRadius: '0 0 0 6px' }} />
                            <div style={{ position: 'absolute', bottom: -6, right: -6, width: 16, height: 16, borderBottom: '3px solid var(--accent-primary)', borderRight: '3px solid var(--accent-primary)', borderRadius: '0 0 6px 0' }} />
                        </div>


                        {/* Stats chip */}
                        <div style={{
                            position: 'absolute', bottom: 16, right: 16,
                            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
                            border: '1px solid var(--border-color)', borderRadius: 12, padding: '10px 18px',
                            display: 'flex', gap: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)' }}>{history.length}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Marked</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-primary)' }}>{scanCount}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Scans</div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ Modal ═══ */}
                    {showModal && result && (
                        <div onClick={dismissModal} style={{
                            position: 'absolute', inset: 0, zIndex: 50,
                            background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease',
                        }}>
                            <div onClick={(e) => e.stopPropagation()} style={{
                                background: 'var(--bg-card)',
                                border: `2px solid ${result.status === 'Present' || result.status === 'Already Marked' ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                                borderRadius: 24, padding: 32, width: 380, maxWidth: '90vw', textAlign: 'center',
                                boxShadow: result.status === 'Present' ? '0 12px 40px rgba(16,185,129,0.15)' : '0 12px 40px rgba(239,68,68,0.1)',
                                animation: 'fadeIn 0.25s ease', position: 'relative',
                            }}>
                                <button onClick={dismissModal} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                                    <X size={18} />
                                </button>
                                <div style={{
                                    width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 16px',
                                    background: result.status === 'Present' ? 'rgba(16,185,129,0.1)' : result.status === 'Already Marked' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                    color: result.status === 'Present' ? 'var(--accent-green)' : result.status === 'Already Marked' ? 'var(--accent-orange)' : 'var(--accent-red)',
                                }}>
                                    {result.status === 'Present' ? <CheckCircle size={36} /> : result.status === 'Already Marked' ? <AlertCircle size={36} /> : <XCircle size={36} />}
                                </div>
                                <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
                                    {result.status === 'Present' ? 'Attendance Marked!' : result.status === 'Already Marked' ? 'Already Marked Today' : result.status}
                                </h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, fontWeight: 500 }}>{result.message}</p>
                                {result.roll_no && (
                                    <div style={{ background: 'var(--bg-input)', borderRadius: 14, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, textAlign: 'left' }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Roll No</div>
                                            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{result.roll_no}</div>
                                        </div>
                                        {result.name && <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Name</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{result.name}</div></div>}
                                        {result.branch && <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Branch</div><div style={{ marginTop: 4 }}><span className="badge branch">{result.branch}</span></div></div>}
                                        {result.similarity != null && <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Confidence</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 2, color: result.similarity >= 0.8 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>{(result.similarity * 100).toFixed(1)}%</div></div>}
                                    </div>
                                )}
                                <div style={{ width: '100%', height: 3, background: 'var(--bg-input)', borderRadius: 2, marginTop: 20, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 2, background: result.status === 'Present' ? 'var(--accent-green)' : 'var(--accent-red)', animation: 'shrink 3.5s linear forwards' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <style>{`@keyframes shrink { from { width: 100%; } to { width: 0%; } }`}</style>
        </>
    );
}
