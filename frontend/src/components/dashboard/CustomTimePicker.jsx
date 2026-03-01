import { useState, useRef, useEffect } from 'react';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';

export default function CustomTimePicker({ value, onChange, label }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Parse 'HH:MM'
    const [hour, setHour] = useState(value ? parseInt(value.split(':')[0], 10) : 9);
    const [minute, setMinute] = useState(value ? parseInt(value.split(':')[1], 10) : 30);

    const isPM = hour >= 12;
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;

    useEffect(() => {
        if (value) {
            setHour(parseInt(value.split(':')[0], 10));
            setMinute(parseInt(value.split(':')[1], 10));
        }
    }, [value]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleApply = (newHour, newMinute) => {
        const hh = newHour.toString().padStart(2, '0');
        const mm = newMinute.toString().padStart(2, '0');
        onChange(`${hh}:${mm}`);
    };

    const toggleAMPM = () => {
        const newHour = isPM ? hour - 12 : hour + 12;
        setHour(newHour);
        handleApply(newHour, minute);
    };

    const incrementHour = () => {
        let newHour = hour + 1;
        if (newHour > 23) newHour = 0;
        setHour(newHour);
        handleApply(newHour, minute);
    };

    const decrementHour = () => {
        let newHour = hour - 1;
        if (newHour < 0) newHour = 23;
        setHour(newHour);
        handleApply(newHour, minute);
    };

    const incrementMinute = () => {
        let newMin = minute + 1;
        let newHour = hour;
        if (newMin > 59) {
            newMin = 0;
            newHour = hour + 1 > 23 ? 0 : hour + 1;
        }
        setMinute(newMin);
        setHour(newHour);
        handleApply(newHour, newMin);
    };

    const decrementMinute = () => {
        let newMin = minute - 1;
        let newHour = hour;
        if (newMin < 0) {
            newMin = 59;
            newHour = hour - 1 < 0 ? 23 : hour - 1;
        }
        setMinute(newMin);
        setHour(newHour);
        handleApply(newHour, newMin);
    };

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            {label && <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>{label}</label>}

            <div
                className="custom-time-input"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', background: 'rgba(255, 255, 255, 0.8)',
                    border: isOpen ? '1.5px solid var(--accent-primary)' : '1.5px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    boxShadow: isOpen ? '0 0 0 3px rgba(13, 148, 136, 0.08)' : 'var(--shadow-xs)',
                    transition: 'all 0.2s', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)'
                }}
            >
                <div>
                    <span style={{ color: 'var(--text-primary)' }}>{displayHour.toString().padStart(2, '0')}</span>
                    <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{minute.toString().padStart(2, '0')}</span>
                    <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--accent-primary)', fontWeight: 800 }}>{isPM ? 'PM' : 'AM'}</span>
                </div>
                <Clock size={18} color="var(--accent-primary)" />
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                    background: '#fff', borderRadius: 'var(--radius-md)', padding: '16px',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.05)',
                    zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    animation: 'fadeInUp 0.2s ease-out forwards'
                }}>

                    {/* Hours */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <button onClick={incrementHour} className="time-spin-btn"><ChevronUp size={20} /></button>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', width: 40, textAlign: 'center' }}>
                            {displayHour.toString().padStart(2, '0')}
                        </div>
                        <button onClick={decrementHour} className="time-spin-btn"><ChevronDown size={20} /></button>
                    </div>

                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-muted)', margin: '0 8px', marginTop: '-4px' }}>:</div>

                    {/* Minutes */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <button onClick={incrementMinute} className="time-spin-btn"><ChevronUp size={20} /></button>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', width: 40, textAlign: 'center' }}>
                            {minute.toString().padStart(2, '0')}
                        </div>
                        <button onClick={decrementMinute} className="time-spin-btn"><ChevronDown size={20} /></button>
                    </div>

                    {/* AM/PM Toggle */}
                    <div style={{ marginLeft: 16 }}>
                        <button
                            onClick={toggleAMPM}
                            style={{
                                background: 'rgba(13, 148, 136, 0.1)', color: 'var(--accent-primary)',
                                border: 'none', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                                fontWeight: 800, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s',

                            }}
                            onMouseOver={(e) => e.target.style.background = 'rgba(13, 148, 136, 0.18)'}
                            onMouseOut={(e) => e.target.style.background = 'rgba(13, 148, 136, 0.1)'}
                        >
                            {isPM ? 'PM' : 'AM'}
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
}
