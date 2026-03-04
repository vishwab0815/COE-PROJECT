import { Camera, Hash, User, BookOpen } from 'lucide-react';
import BranchSelect from '../ui/BranchSelect';

/**
 * RegistrationForm — Bottom-anchored glass panel with student input fields.
 */
export default function RegistrationForm({ rollNo, setRollNo, name, setName, branch, setBranch, onSubmit }) {
    const isValid = rollNo.trim() && name.trim();

    return (
        <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderTop: '1px solid var(--border-color)',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.06)',
            padding: '20px 32px 24px',
        }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1.6fr 0.8fr auto',
                    gap: 14, alignItems: 'end'
                }}>
                    {/* Roll Number */}
                    <div>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontSize: 11, fontWeight: 700,
                            color: 'var(--text-muted)', letterSpacing: '0.06em',
                            textTransform: 'uppercase', marginBottom: 8,
                        }}>
                            <Hash size={11} strokeWidth={2.5} />
                            Roll Number <span style={{ color: 'var(--accent-red)' }}>*</span>
                        </label>
                        <input
                            className="input"
                            placeholder="1RV22CSE001"
                            value={rollNo}
                            onChange={(e) => setRollNo(e.target.value.toUpperCase())}
                            style={{
                                height: 46, fontSize: 14, fontWeight: 700,
                                background: '#fff', borderColor: 'var(--border-color)',
                                letterSpacing: '0.03em',
                            }}
                        />
                    </div>

                    {/* Full Name */}
                    <div>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontSize: 11, fontWeight: 700,
                            color: 'var(--text-muted)', letterSpacing: '0.06em',
                            textTransform: 'uppercase', marginBottom: 8,
                        }}>
                            <User size={11} strokeWidth={2.5} />
                            Full Name <span style={{ color: 'var(--accent-red)' }}>*</span>
                        </label>
                        <input
                            className="input"
                            placeholder="Rahul Kumar"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{
                                height: 46, fontSize: 14, fontWeight: 600,
                                background: '#fff', borderColor: 'var(--border-color)',
                            }}
                        />
                    </div>

                    {/* Branch */}
                    <div>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontSize: 11, fontWeight: 700,
                            color: 'var(--text-muted)', letterSpacing: '0.06em',
                            textTransform: 'uppercase', marginBottom: 8,
                        }}>
                            <BookOpen size={11} strokeWidth={2.5} />
                            Branch
                        </label>
                        <BranchSelect value={branch} onChange={setBranch} />
                    </div>

                    {/* Submit Button */}
                    <button
                        className="btn btn-success"
                        onClick={onSubmit}
                        disabled={!isValid}
                        style={{
                            height: 46, whiteSpace: 'nowrap',
                            fontSize: 14, fontWeight: 700,
                            padding: '0 28px', borderRadius: 14,
                            letterSpacing: '-0.01em',
                            boxShadow: isValid
                                ? '0 4px 16px rgba(16, 185, 129, 0.3)'
                                : 'none',
                        }}
                    >
                        <Camera size={16} /> Start Capture
                    </button>
                </div>
            </div>
        </div>
    );
}
