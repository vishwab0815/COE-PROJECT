export const API_BASE = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'attend_ai_token';
export const UNAUTHORIZED_EVENT = 'attend-ai:unauthorized';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res) {
    if (!res.ok) {
        if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(typeof err.detail === 'string' ? err.detail : `Request failed: ${res.status}`);
    }
    return res;
}

async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
    });
    return handleResponse(res);
}

async function upload(path, formData) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
    });
    return res;
}

export const api = {
    // Health
    health: () => request('/health').then(r => r.json()),

    // Auth
    login: async (pin) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || `Login failed: ${res.status}`);
        }
        return res.json();
    },

    // Students
    getStudents: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/students?${q}`).then(r => r.json());
    },

    getStudent: (rollNo) => request(`/students/${encodeURIComponent(rollNo)}`).then(r => r.json()),

    deleteStudent: (rollNo) =>
        request(`/students/${encodeURIComponent(rollNo)}`, { method: 'DELETE' }).then(r => r.json()),

    registerStudent: (data) =>
        request('/register', {
            method: 'POST',
            body: JSON.stringify(data),
        }).then(r => r.json()),

    // Attendance
    markAttendance: async (imageBlob) => {
        const formData = new FormData();
        formData.append('file', imageBlob, 'capture.jpg');
        return (await upload('/mark-attendance', formData)).json();
    },

    markAttendanceMulti: async (imageBlob) => {
        const formData = new FormData();
        formData.append('file', imageBlob, 'capture.jpg');
        return (await upload('/mark-attendance-multi', formData)).json();
    },

    registerWithFace: async (studentInfo, imageBlobs) => {
        const formData = new FormData();
        formData.append('roll_no', studentInfo.roll_no);
        formData.append('name', studentInfo.name);
        formData.append('branch', studentInfo.branch);
        imageBlobs.forEach((blob, i) => {
            formData.append('files', blob, `capture_${i}.jpg`);
        });

        const res = await handleResponse(await upload('/register-with-face', formData));
        return res.json();
    },

    // Live stream (public kiosk endpoints)
    videoFeedUrl: () => `${API_BASE}/video-feed?t=${Date.now()}`,

    pauseStream: () => request('/stream/pause', { method: 'POST', keepalive: true }).then(r => r.json()),

    resumeStream: () => request('/stream/resume', { method: 'POST', keepalive: true }).then(r => r.json()),

    // sendBeacon survives route unmount / tab close where fetch may be cancelled
    pauseStreamBeacon: () => navigator.sendBeacon(`${API_BASE}/stream/pause`),

    getRecentMarked: () => request('/recent-marked').then(r => r.json()),

    getShiftConfig: () => request('/shift-config').then(r => r.json()),

    updateShiftConfig: (data) =>
        request('/shift-config', {
            method: 'POST',
            body: JSON.stringify(data),
        }).then(r => r.json()),

    getAttendanceReport: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/attendance-report?${q}`).then(r => r.json());
    },

    getAttendanceStats: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/attendance-stats?${q}`).then(r => r.json());
    },

    // Fetch with the auth header, then trigger a download (window.open can't send headers)
    exportCSV: async (params = {}) => {
        const q = new URLSearchParams(params).toString();
        const res = await request(`/attendance-report/csv?${q}`);
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_report_${params.date || 'all'}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },
};
