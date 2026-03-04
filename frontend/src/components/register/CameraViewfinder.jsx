/**
 * CameraViewfinder — The face-alignment guide overlay on the camera feed.
 * Shows dashed corners in idle mode and a solid green glow during capture.
 */
export default function CameraViewfinder({ isCapturing }) {
    return (
        <div style={{
            position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 200, height: 260,
            border: isCapturing ? '3px solid var(--accent-green)' : '2px dashed rgba(13,148,136,0.25)',
            borderRadius: 24, pointerEvents: 'none', transition: 'all 0.3s',
            boxShadow: isCapturing ? '0 0 30px rgba(16,185,129,0.2)' : 'none',
        }}>
            {/* Corner brackets */}
            <div style={{ position: 'absolute', top: -6, left: -6, width: 18, height: 18, borderTop: '3px solid var(--accent-primary)', borderLeft: '3px solid var(--accent-primary)', borderRadius: '8px 0 0 0' }} />
            <div style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderTop: '3px solid var(--accent-primary)', borderRight: '3px solid var(--accent-primary)', borderRadius: '0 8px 0 0' }} />
            <div style={{ position: 'absolute', bottom: -6, left: -6, width: 18, height: 18, borderBottom: '3px solid var(--accent-primary)', borderLeft: '3px solid var(--accent-primary)', borderRadius: '0 0 0 8px' }} />
            <div style={{ position: 'absolute', bottom: -6, right: -6, width: 18, height: 18, borderBottom: '3px solid var(--accent-primary)', borderRight: '3px solid var(--accent-primary)', borderRadius: '0 0 8px 0' }} />
        </div>
    );
}
