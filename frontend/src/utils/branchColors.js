/**
 * Shared branch color definitions and utilities.
 * Used across Students, Register, and other pages for consistent visual identity.
 */

export const BRANCH_COLORS = {
    CSE: { bg: 'rgba(14, 165, 233, 0.08)', color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' },
    AIML: { bg: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' },
    ISE: { bg: 'rgba(16, 185, 129, 0.08)', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #34d399)' },
    ECE: { bg: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
    ME: { bg: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #f87171)' },
    EEE: { bg: 'rgba(6, 182, 212, 0.08)', color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)' },
    CIVIL: { bg: 'rgba(234, 88, 12, 0.08)', color: '#ea580c', gradient: 'linear-gradient(135deg, #ea580c, #f97316)' },
    CSD: { bg: 'rgba(236, 72, 153, 0.08)', color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #f472b6)' },
    CSDS: { bg: 'rgba(99, 102, 241, 0.08)', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #818cf8)' },
};

export const DEFAULT_BRANCH_STYLE = {
    bg: 'rgba(13, 148, 136, 0.08)', color: '#0d9488', gradient: 'linear-gradient(135deg, #0d9488, #14b8a6)'
};

export const BRANCHES = ['CSE', 'ECE', 'ME', 'EEE', 'CIVIL', 'ISE', 'AIML', 'CSD', 'CSDS'];

export function getBranchStyle(branch) {
    return BRANCH_COLORS[branch?.toUpperCase()] || DEFAULT_BRANCH_STYLE;
}

export function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0]?.toUpperCase() || '?';
}
