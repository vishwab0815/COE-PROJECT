import { createContext, useContext, useState, useEffect, useRef } from 'react';

const AuthContext = createContext(null);

const ADMIN_PIN = '1234';
const SESSION_DURATION = 5 * 60 * 1000; // 5 minutes in ms

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        const expiresAt = localStorage.getItem('attend_ai_expires');
        if (expiresAt && Date.now() < Number(expiresAt)) return true;
        // Expired or never set — clean up
        localStorage.removeItem('attend_ai_auth');
        localStorage.removeItem('attend_ai_expires');
        return false;
    });

    const timerRef = useRef(null);

    // Start/restart the auto-logout timer
    const startTimer = (expiresAt) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) { logout(); return; }
        timerRef.current = setTimeout(() => logout(), remaining);
    };

    useEffect(() => {
        if (isAuthenticated) {
            const expiresAt = Number(localStorage.getItem('attend_ai_expires'));
            if (expiresAt) startTimer(expiresAt);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [isAuthenticated]);

    const login = (pin) => {
        if (pin === ADMIN_PIN) {
            const expiresAt = Date.now() + SESSION_DURATION;
            setIsAuthenticated(true);
            localStorage.setItem('attend_ai_auth', 'true');
            localStorage.setItem('attend_ai_expires', String(expiresAt));
            startTimer(expiresAt);
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem('attend_ai_auth');
        localStorage.removeItem('attend_ai_expires');
        if (timerRef.current) clearTimeout(timerRef.current);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
