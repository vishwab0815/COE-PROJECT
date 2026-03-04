/**
 * RegisterPage — Slim orchestrator that composes all registration sub-components.
 *
 * File Structure:
 *   components/register/
 *   ├── CameraViewfinder.jsx   — Face alignment guide overlay
 *   ├── CountdownOverlay.jsx   — 3-2-1 countdown before capture
 *   ├── CapturingOverlay.jsx   — Live capture progress + counter
 *   ├── ProcessingOverlay.jsx  — GPU processing spinner
 *   ├── SuccessModal.jsx       — Post-registration success card
 *   ├── ErrorModal.jsx         — Error state with retry
 *   └── RegistrationForm.jsx   — Bottom-anchored input form
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { api } from '../services/api';
import { UserPlus, Scan } from 'lucide-react';

// Components
import CameraViewfinder from '../components/register/CameraViewfinder';
import CountdownOverlay from '../components/register/CountdownOverlay';
import CapturingOverlay from '../components/register/CapturingOverlay';
import ProcessingOverlay from '../components/register/ProcessingOverlay';
import SuccessModal from '../components/register/SuccessModal';
import ErrorModal from '../components/register/ErrorModal';
import RegistrationForm from '../components/register/RegistrationForm';

const TOTAL_CAPTURES = 15;
const CAPTURE_INTERVAL_MS = 300;

export default function RegisterPage() {
    const navigate = useNavigate();
    const webcamRef = useRef(null);

    const [rollNo, setRollNo] = useState('');
    const [name, setName] = useState('');
    const [branch, setBranch] = useState('CSE');
    const [phase, setPhase] = useState('form'); // form | countdown | capturing | processing | done | error
    const [countdown, setCountdown] = useState(3);
    const [capturedCount, setCapturedCount] = useState(0);
    const [capturedImages, setCapturedImages] = useState([]);
    const [result, setResult] = useState(null);
    const [cameraReady, setCameraReady] = useState(false);

    // ── Pause backend stream to grab exclusive camera access ──
    useEffect(() => {
        let isMounted = true;
        api.pauseStream()
            .then(() => { if (isMounted) setCameraReady(true); })
            .catch(() => { if (isMounted) setCameraReady(true); });
        return () => { isMounted = false; };
    }, []);

    // ── Countdown timer ──
    useEffect(() => {
        if (phase !== 'countdown') return;
        if (countdown <= 0) { setPhase('capturing'); return; }
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [phase, countdown]);

    // ── Burst capture loop ──
    useEffect(() => {
        if (phase !== 'capturing') return;
        let count = 0;
        const images = [];
        const captureLoop = setInterval(() => {
            if (!webcamRef.current || count >= TOTAL_CAPTURES) {
                clearInterval(captureLoop);
                setCapturedImages(images);
                setPhase('processing');
                return;
            }
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) { images.push(imageSrc); count++; setCapturedCount(count); }
        }, CAPTURE_INTERVAL_MS);
        return () => clearInterval(captureLoop);
    }, [phase]);

    // ── Upload and process on GPU ──
    useEffect(() => {
        if (phase !== 'processing' || capturedImages.length === 0) return;
        const processImages = async () => {
            try {
                const blobs = await Promise.all(
                    capturedImages.map(async (src) => { const res = await fetch(src); return res.blob(); })
                );
                const data = await api.registerWithFace({ roll_no: rollNo.toUpperCase(), name, branch }, blobs);
                setResult(data);
                setPhase(data.success ? 'done' : 'error');
            } catch (err) {
                setResult({ success: false, message: err.message });
                setPhase('error');
            }
        };
        processImages();
    }, [phase, capturedImages]);

    // ── Handlers ──
    const startCapture = () => {
        if (!rollNo.trim() || !name.trim()) return;
        setPhase('countdown');
        setCountdown(3);
        setCapturedCount(0);
        setCapturedImages([]);
        setResult(null);
    };

    const reset = () => {
        setPhase('form');
        setRollNo('');
        setName('');
        setBranch('CSE');
        setCapturedCount(0);
        setCapturedImages([]);
        setResult(null);
        setCountdown(3);
    };

    return (
        <>
            {/* Header */}
            <div className="page-header" style={{ padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                        width: 36, height: 36, borderRadius: 12,
                        background: 'var(--gradient-green)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)'
                    }}>
                        <UserPlus size={18} color="#fff" />
                    </span>
                    <div>
                        <h2 style={{ fontSize: 18 }}>Register New Student</h2>
                        <p>Fill in details → Face capture → Instant enrollment</p>
                    </div>
                </div>
                {phase !== 'form' && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'rgba(16, 185, 129, 0.06)', padding: '6px 14px',
                        borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 700,
                        color: '#10b981'
                    }}>
                        <Scan size={14} />
                        {phase === 'countdown' && 'Starting...'}
                        {phase === 'capturing' && `Capturing ${capturedCount}/${TOTAL_CAPTURES}`}
                        {phase === 'processing' && 'Processing...'}
                        {phase === 'done' && 'Complete!'}
                        {phase === 'error' && 'Failed'}
                    </div>
                )}
            </div>

            {/* Camera viewport */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                <div style={{ flex: 1, position: 'relative', background: '#0c1222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>

                        {/* Camera feed */}
                        {cameraReady ? (
                            <Webcam
                                ref={webcamRef} audio={false}
                                screenshotFormat="image/jpeg" screenshotQuality={0.92}
                                videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                        ) : (
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                background: '#0c1222'
                            }}>
                                <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, marginBottom: 16 }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Acquiring Camera...</span>
                            </div>
                        )}

                        {/* Viewfinder */}
                        <CameraViewfinder isCapturing={phase === 'capturing'} />

                        {/* Phase overlays */}
                        {phase === 'countdown' && <CountdownOverlay countdown={countdown} />}
                        {phase === 'capturing' && <CapturingOverlay capturedCount={capturedCount} totalCaptures={TOTAL_CAPTURES} />}
                        {phase === 'processing' && <ProcessingOverlay imageCount={capturedImages.length} />}
                        {phase === 'done' && result && <SuccessModal result={result} onReset={reset} onDashboard={() => navigate('/')} />}
                        {phase === 'error' && result && <ErrorModal result={result} onReset={reset} />}

                        {/* Form */}
                        {phase === 'form' && (
                            <RegistrationForm
                                rollNo={rollNo} setRollNo={setRollNo}
                                name={name} setName={setName}
                                branch={branch} setBranch={setBranch}
                                onSubmit={startCapture}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
