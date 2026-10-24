import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api, setToken, getToken, UNAUTHORIZED_EVENT } from '../services/api';

const AuthContext = createContext(null);

const EXPIRES_KEY = 'attend_ai_expires';

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        const expiresAt = localStorage.getItem(EXPIRES_KEY);
        if (getToken() && expiresAt && Date.now() < Number(expiresAt)) return true;
        // Expired or never set — clean up
        setToken(null);
        localStorage.removeItem(EXPIRES_KEY);
        return false;
    });

    const timerRef = useRef(null);

    const logout = useCallback(() => {
        setIsAuthenticated(false);
        setToken(null);
        localStorage.removeItem(EXPIRES_KEY);
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    // Start/restart the auto-logout timer
    const startTimer = useCallback((expiresAt) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(logout, Math.max(0, expiresAt - Date.now()));
    }, [logout]);

    useEffect(() => {
        if (isAuthenticated) {
            const expiresAt = Number(localStorage.getItem(EXPIRES_KEY));
            if (expiresAt) startTimer(expiresAt);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [isAuthenticated, startTimer]);

    // Server rejected our token (expired / server restarted) → back to login
    useEffect(() => {
        window.addEventListener(UNAUTHORIZED_EVENT, logout);
        return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
    }, [logout]);

    /** Validates the PIN on the server. Resolves true/false; throws on network errors. */
    const login = async (pin) => {
        try {
            const { token, expires_at } = await api.login(pin);
            setToken(token);
            localStorage.setItem(EXPIRES_KEY, String(expires_at));
            setIsAuthenticated(true);
            startTimer(expires_at);
            return true;
        } catch (err) {
            if (err.message === 'Incorrect PIN') return false;
            throw err;
        }
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
