const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Request failed: ${res.status}`);
    }

    return res;
}

export const api = {
    // Health
    health: () => request('/').then(r => r.json()),

    // Students
    getStudents: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return request(`/students?${q}`).then(r => r.json());
    },

    getStudent: (rollNo) => request(`/students/${rollNo}`).then(r => r.json()),

    deleteStudent: (rollNo) =>
        request(`/students/${rollNo}`, { method: 'DELETE' }).then(r => r.json()),

    registerStudent: (data) =>
        request('/register', {
            method: 'POST',
            body: JSON.stringify(data),
        }).then(r => r.json()),

    // Attendance
    markAttendance: async (imageBlob) => {
        const formData = new FormData();
        formData.append('file', imageBlob, 'capture.jpg');

        const res = await fetch(`${API_BASE}/mark-attendance`, {
            method: 'POST',
            body: formData,
        });

        return res.json();
    },

    markAttendanceMulti: async (imageBlob) => {
        const formData = new FormData();
        formData.append('file', imageBlob, 'capture.jpg');

        const res = await fetch(`${API_BASE}/mark-attendance-multi`, {
            method: 'POST',
            body: formData,
        });

        return res.json();
    },

    registerWithFace: async (studentInfo, imageBlobs) => {
        const formData = new FormData();
        formData.append('roll_no', studentInfo.roll_no);
        formData.append('name', studentInfo.name);
        formData.append('branch', studentInfo.branch);
        imageBlobs.forEach((blob, i) => {
            formData.append('files', blob, `capture_${i}.jpg`);
        });

        const res = await fetch(`${API_BASE}/register-with-face`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || `Registration failed: ${res.status}`);
        }

        return res.json();
    },

    pauseStream: () => request('/stream/pause', { method: 'POST', keepalive: true }).then(r => r.json()),

    resumeStream: () => request('/stream/resume', { method: 'POST', keepalive: true }).then(r => r.json()),

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

    exportCSV: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        window.open(`${API_BASE}/attendance-report/csv?${q}`, '_blank');
    },
};
