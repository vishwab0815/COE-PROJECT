import { useState, useRef, useEffect } from 'react';
import { ChevronDown, BookOpen } from 'lucide-react';
import { BRANCHES, getBranchStyle } from '../../utils/branchColors';

/**
 * BranchSelect — A custom styled dropdown for selecting a branch.
 * Replaces the native <select> with a premium animated dropdown
 * featuring color-coded branch badges.
 *
 * Props:
 *   value    — currently selected branch string
 *   onChange — callback(branchString)
 */
export default function BranchSelect({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const activeStyle = getBranchStyle(value);

    // Close dropdown on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const handleSelect = (branch) => {
        onChange(branch);
        setOpen(false);
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%', height: 46,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 14px',
                    background: '#fff',
                    border: `1.5px solid ${open ? activeStyle.color : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: open ? `0 0 0 3px ${activeStyle.color}14, 0 4px 16px ${activeStyle.color}10` : 'none',
                    fontFamily: 'var(--font)',
                    outline: 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: activeStyle.gradient,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <BookOpen size={11} color="#fff" strokeWidth={2.5} />
                    </span>
                    <span style={{
                        fontSize: 14, fontWeight: 700,
                        color: 'var(--text-primary)', letterSpacing: '0.02em'
                    }}>
                        {value}
                    </span>
                </div>
                <ChevronDown
                    size={16}
                    style={{
                        color: 'var(--text-muted)',
                        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}
                />
            </button>

            {/* Dropdown Menu */}
            {open && (
                <div style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0,
                    marginBottom: 6, zIndex: 9999,
                    background: '#fff',
                    border: '1px solid var(--border-color)',
                    borderRadius: 14,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.02)',
                    overflow: 'hidden',
                    animation: 'fadeIn 0.15s ease',
                    maxHeight: 280, overflowY: 'auto',
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '10px 14px 8px',
                        fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        borderBottom: '1px solid var(--border-light)',
                    }}>
                        Select Branch
                    </div>

                    {/* Options */}
                    {BRANCHES.map((branch) => {
                        const style = getBranchStyle(branch);
                        const isActive = value === branch;

                        return (
                            <button
                                key={branch}
                                type="button"
                                onClick={() => handleSelect(branch)}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 14px',
                                    background: isActive ? style.bg : 'transparent',
                                    border: 'none', cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    fontFamily: 'var(--font)',
                                    outline: 'none',
                                    borderLeft: isActive ? `3px solid ${style.color}` : '3px solid transparent',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = isActive ? style.bg : 'transparent';
                                }}
                            >
                                {/* Colored dot */}
                                <span style={{
                                    width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                                    background: style.gradient,
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: `0 2px 6px ${style.color}25`,
                                }}>
                                    <BookOpen size={11} color="#fff" strokeWidth={2.5} />
                                </span>

                                <span style={{
                                    fontSize: 13, fontWeight: isActive ? 800 : 600,
                                    color: isActive ? style.color : 'var(--text-secondary)',
                                    letterSpacing: '0.02em',
                                }}>
                                    {branch}
                                </span>

                                {/* Active checkmark */}
                                {isActive && (
                                    <span style={{
                                        marginLeft: 'auto', fontSize: 11, fontWeight: 800,
                                        color: style.color
                                    }}>
                                        ✓
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
