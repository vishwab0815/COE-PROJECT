import { Camera } from 'lucide-react';

/**
 * CapturingOverlay — Shows capture progress with a live counter and progress bar.
 */
export default function CapturingOverlay({ capturedCount, totalCaptures }) {
    const percent = (capturedCount / totalCaptures) * 100;

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            border: '4px solid var(--accent-green)',
            pointerEvents: 'none',
            animation: 'pulse 0.3s ease-in-out infinite',
        }}>
            {/* Status pill */}
            <div style={{
                position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                padding: '10px 24px', borderRadius: 14,
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                border: '1px solid rgba(16,185,129,0.15)'
            }}>
                <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--accent-green)',
                    boxShadow: '0 0 8px rgba(16,185,129,0.5)',
                    animation: 'breathe 1s ease-in-out infinite'
                }} />
                <Camera size={16} style={{ color: 'var(--accent-green)' }} />
                <span style={{
                    fontWeight: 800, color: 'var(--text-primary)',
                    fontSize: 14, letterSpacing: '-0.01em'
                }}>
                    Capturing... {capturedCount}/{totalCaptures}
                </span>
            </div>

            {/* Bottom progress bar */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 5, background: 'rgba(0,0,0,0.05)'
            }}>
                <div style={{
                    height: '100%', background: 'var(--gradient-green)',
                    width: `${percent}%`, transition: 'width 0.2s', borderRadius: 3
                }} />
            </div>
        </div>
    );
}
