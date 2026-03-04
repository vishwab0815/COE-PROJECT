/**
 * CountdownOverlay — Full-screen countdown (3, 2, 1) before capture begins.
 */
export default function CountdownOverlay({ countdown }) {
    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                fontSize: 120, fontWeight: 900,
                color: 'var(--accent-primary)',
                textShadow: '0 0 40px rgba(13,148,136,0.3)',
                animation: 'pulse 1s ease-in-out',
                lineHeight: 1
            }}>
                {countdown}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, fontWeight: 600, marginTop: 12 }}>
                Get ready — look straight at the camera
            </p>
        </div>
    );
}
