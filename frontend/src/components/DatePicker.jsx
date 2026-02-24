import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

export default function DatePicker({ value, onChange, style }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const selected = value ? new Date(value + 'T00:00:00') : new Date();
    const [viewMonth, setViewMonth] = useState(selected.getMonth());
    const [viewYear, setViewYear] = useState(selected.getFullYear());

    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    useEffect(() => {
        if (value) {
            const d = new Date(value + 'T00:00:00');
            setViewMonth(d.getMonth());
            setViewYear(d.getFullYear());
        }
    }, [value]);

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const selectDate = (day) => {
        const m = String(viewMonth + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        onChange(`${viewYear}-${m}-${d}`);
        setOpen(false);
    };

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const goToday = () => {
        onChange(todayStr);
        setViewMonth(today.getMonth());
        setViewYear(today.getFullYear());
        setOpen(false);
    };

    const formatDisplay = (val) => {
        if (!val) return 'Select date';
        const d = new Date(val + 'T00:00:00');
        return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
    };

    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, type: 'prev' });
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ day: d, type: 'current', isToday: dateStr === todayStr, isSelected: dateStr === value });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) cells.push({ day: d, type: 'next' });

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-block', ...style }}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px',
                    background: open ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    border: `1.5px solid ${open ? 'var(--accent-primary)' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font)',
                    fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
                    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                    boxShadow: open
                        ? '0 0 0 3px rgba(13,148,136,0.08), 0 4px 16px rgba(13,148,136,0.06)'
                        : '0 1px 3px rgba(0,0,0,0.03)',
                    letterSpacing: '0.02em', outline: 'none',
                }}
                onMouseEnter={e => {
                    if (!open) {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.background = 'rgba(240,253,250,0.8)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 14px rgba(13,148,136,0.06)';
                    }
                }}
                onMouseLeave={e => {
                    if (!open) {
                        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.7)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                    }
                }}
            >
                <Calendar size={16} style={{ color: 'var(--accent-primary)' }} />
                <span>{formatDisplay(value)}</span>
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1000,
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    borderRadius: 20, border: '1px solid rgba(0,0,0,0.06)',
                    boxShadow: '0 20px 64px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.03)',
                    padding: 20, width: 300, fontFamily: 'var(--font)',
                    animation: 'fadeIn 0.2s cubic-bezier(0.4,0,0.2,1)',
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <button type="button" onClick={prevMonth} style={{
                            background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: 10,
                            padding: 7, cursor: 'pointer', display: 'flex', color: 'var(--text-secondary)',
                            transition: 'all 0.15s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(13,148,136,0.06)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0c1222', letterSpacing: '-0.02em' }}>
                            {MONTHS[viewMonth]} {viewYear}
                        </div>
                        <button type="button" onClick={nextMonth} style={{
                            background: 'rgba(0,0,0,0.03)', border: 'none', borderRadius: 10,
                            padding: 7, cursor: 'pointer', display: 'flex', color: 'var(--text-secondary)',
                            transition: 'all 0.15s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(13,148,136,0.06)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Day labels */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                        {DAYS.map(d => (
                            <div key={d} style={{
                                textAlign: 'center', fontSize: 11, fontWeight: 700,
                                color: '#8896ab', padding: '4px 0', letterSpacing: '0.04em',
                            }}>{d}</div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                        {cells.map((cell, i) => (
                            <button
                                key={i}
                                type="button"
                                disabled={cell.type !== 'current'}
                                onClick={() => cell.type === 'current' && selectDate(cell.day)}
                                style={{
                                    width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    borderRadius: 10, border: 'none', cursor: cell.type === 'current' ? 'pointer' : 'default',
                                    fontSize: 13, fontWeight: cell.isSelected ? 800 : cell.isToday ? 700 : 500,
                                    fontFamily: 'var(--font)',
                                    background: cell.isSelected ? 'var(--gradient-primary)'
                                        : cell.isToday ? 'rgba(13,148,136,0.06)' : 'transparent',
                                    color: cell.isSelected ? '#fff'
                                        : cell.type !== 'current' ? '#d1d5db'
                                            : cell.isToday ? 'var(--accent-primary)' : '#334155',
                                    transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)',
                                    boxShadow: cell.isSelected ? '0 2px 8px rgba(13,148,136,0.2)' : 'none',
                                }}
                                onMouseEnter={e => {
                                    if (cell.type === 'current' && !cell.isSelected) {
                                        e.currentTarget.style.background = 'rgba(13,148,136,0.05)';
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (cell.type === 'current' && !cell.isSelected) {
                                        e.currentTarget.style.background = cell.isToday ? 'rgba(13,148,136,0.06)' : 'transparent';
                                        e.currentTarget.style.transform = 'scale(1)';
                                    }
                                }}
                            >
                                {cell.day}
                            </button>
                        ))}
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                        <button type="button" onClick={() => setOpen(false)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 12, fontWeight: 700, color: '#8896ab', fontFamily: 'var(--font)',
                            padding: '5px 10px', borderRadius: 8, transition: 'all 0.15s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#3e4c63'; e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#8896ab'; e.currentTarget.style.background = 'none'; }}
                        >Cancel</button>
                        <button type="button" onClick={goToday} style={{
                            background: 'rgba(13,148,136,0.06)', border: 'none', cursor: 'pointer',
                            fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font)',
                            padding: '5px 14px', borderRadius: 8, transition: 'all 0.15s',
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(13,148,136,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(13,148,136,0.06)'}
                        >Today</button>
                    </div>
                </div>
            )}
        </div>
    );
}
