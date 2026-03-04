import { XCircle, RotateCcw } from 'lucide-react';

/**
 * ErrorModal — Shown when registration fails with an error message.
 */
export default function ErrorModal({ result, onReset }) {
    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: '#fff', borderRadius: 28, padding: '36px 40px',
                width: 420, maxWidth: '90vw', textAlign: 'center',
                border: '1px solid rgba(239,68,68,0.12)',
                boxShadow: '0 24px 64px rgba(239,68,68,0.1), 0 0 0 1px rgba(0,0,0,0.02)',
                animation: 'fadeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
                <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 18px',
                    boxShadow: '0 0 0 8px rgba(239,68,68,0.04)'
                }}>
                    <XCircle size={36} />
                </div>
                <h3 style={{
                    fontSize: 20, fontWeight: 800, marginBottom: 8,
                    letterSpacing: '-0.03em', color: 'var(--text-primary)'
                }}>
                    Registration Failed
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28, fontWeight: 500, lineHeight: 1.6 }}>
                    {result.message || result.error || 'An unknown error occurred'}
                </p>
                <button className="btn btn-outline" onClick={onReset} style={{ width: '100%', justifyContent: 'center', borderRadius: 14 }}>
                    <RotateCcw size={15} /> Try Again
                </button>
            </div>
        </div>
    );
}
