import React, { useMemo } from 'react';
import type { User } from '../types';
import { APP_VERSION } from '../constants';

interface HeaderProps {
    currentUser: User;
    onLogout: () => void;
    activeUsers?: number | null;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, activeUsers }) => {
    const roleLabel = useMemo(() => {
        const formatted = currentUser.role.replace(/-/g, ' ');
        return formatted.replace(/\b\w/g, letter => letter.toUpperCase());
    }, [currentUser.role]);

    const todayLabel = useMemo(
        () => new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        }),
        [],
    );

    const activeUsersLabel = typeof activeUsers === 'number' ? activeUsers.toLocaleString() : 'N/A';

    return (
        <header className="bg-gradient-to-br from-white via-indigo-50 to-sky-50 rounded-3xl shadow-lg border border-white/60 backdrop-blur p-6 sm:p-8 mb-6">
            <div className="grid gap-6 md:grid-cols-[auto,1fr,auto] md:items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">GMCT Management System</h1>
                    <p className="text-sm font-semibold text-slate-500">Version {APP_VERSION}</p>
                </div>
                <div className="flex flex-col items-start text-slate-600 md:items-center md:text-center">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Today</p>
                    <p className="text-lg font-semibold text-slate-800">{todayLabel}</p>
                    <p className="text-xs font-medium text-slate-500">Active users: {activeUsersLabel}</p>
                </div>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
                    <div className="text-left sm:text-right">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Signed in</p>
                        <p className="text-lg font-semibold text-slate-800">{currentUser.username}</p>
                        <p className="text-xs font-medium text-slate-500">{roleLabel}</p>
                    </div>
                    <button
                        onClick={onLogout}
                        className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow-sm"
                    >
                        Log out
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
