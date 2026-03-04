import { Cpu } from 'lucide-react';

/**
 * ProcessingOverlay — Shown while images are being uploaded and processed on GPU.
 */
export default function ProcessingOverlay({ imageCount }) {
    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: 'rgba(13, 148, 136, 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20
            }}>
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
            </div>
            <h3 style={{
                fontSize: 18, marginBottom: 8, fontWeight: 800,
                letterSpacing: '-0.02em', color: 'var(--text-primary)'
            }}>
                Processing on GPU...
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                Extracting face embeddings from {imageCount} images
            </p>
            <div style={{
                marginTop: 20, display: 'flex', gap: 6
            }}>
                {[0, 1, 2].map(i => (
                    <div key={i} style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--accent-primary)',
                        animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite`
                    }} />
                ))}
            </div>
        </div>
    );
}
