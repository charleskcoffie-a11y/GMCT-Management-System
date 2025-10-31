import React, { useMemo } from 'react';
import type { User } from '../types';
import { APP_VERSION } from '../constants';

interface HeaderProps {
    currentUser: User | null;
    onLogout: () => void;
    currentDate: Date;
    activeUserCount: number | null;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, currentDate, activeUserCount }) => {
    const roleLabel = useMemo(() => {
        if (!currentUser) return '';
        const formatted = currentUser.role.replace(/-/g, ' ');
        return formatted.replace(/\b\w/g, letter => letter.toUpperCase());
    }, [currentUser]);

    const formattedDate = useMemo(
        () =>
            currentDate.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
            }),
        [currentDate],
    );

    const activeUsersLabel = activeUserCount === null ? 'Active users: N/A' : `Active users: ${activeUserCount}`;

    return (
        <header className="bg-gradient-to-br from-white via-indigo-50 to-sky-50 rounded-3xl shadow-lg border border-white/60 backdrop-blur p-6 sm:p-8 mb-6">
            <div className="grid gap-6 md:grid-cols-[auto,1fr,auto] md:items-center">
                <div className="text-center md:text-left">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">GMCT Management System</h1>
                    <p className="text-sm font-semibold text-slate-500">Version {APP_VERSION}</p>
                </div>
                <div className="flex flex-col items-center justify-center text-center gap-1">
                    <p className="text-lg font-semibold text-slate-700" aria-live="polite">
                        {formattedDate}
                    </p>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{activeUsersLabel}</p>
                </div>
                {currentUser && (
                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-end sm:items-center md:items-end">
                        <div className="text-center sm:text-right">
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
                )}
            </div>
        </header>
    );
};

export default Header;
