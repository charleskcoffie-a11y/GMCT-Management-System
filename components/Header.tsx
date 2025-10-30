import React, { useRef } from 'react';
import type { Entry, User } from '../types';
import { fromCsv, sanitizeEntry } from '../utils';

type HeaderProps = {
    entries: Entry[];
    onImport: (entries: Entry[]) => void;
    onExport: (format: 'csv' | 'json') => void;
    currentUser: User;
    onLogout: () => void;
    appVersion: string;
};

const Header: React.FC<HeaderProps> = ({ entries: _entries, onImport, onExport, currentUser, onLogout, appVersion }) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = reader.result as string;
                if (file.name.endsWith('.csv')) {
                    const rows = fromCsv(text);
                    const imported = rows.map(row => sanitizeEntry(row));
                    onImport(imported);
                } else {
                    const raw = JSON.parse(text) as unknown;
                    const array = Array.isArray(raw) ? raw : [];
                    const imported = array.map(item => sanitizeEntry(item));
                    onImport(imported);
                }
            } catch (error) {
                console.error('Failed to import file', error);
                alert('Unable to import the selected file. Ensure it is a valid CSV or JSON export.');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    return (
        <header className="bg-gradient-to-br from-white via-indigo-50 to-sky-50 rounded-3xl shadow-lg border border-white/60 backdrop-blur p-6 sm:p-8 mb-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">GMCT Management System</h1>
                    <p className="text-slate-500">Welcome back, {currentUser.username}. Manage contributions, members, and attendance seamlessly.</p>
                </div>
                <div className="flex flex-col items-stretch gap-2 md:items-end">
                    <span className="text-xs uppercase tracking-wider text-slate-400">Version {appVersion}</span>
                    <div className="flex flex-wrap gap-3 justify-end">
                        <div className="flex flex-col items-start">
                            <button
                                onClick={() => onExport('csv')}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm"
                                title="Download financial records as CSV"
                            >
                                Export CSV
                            </button>
                            <span className="text-xs text-slate-500 mt-1">Financial Records</span>
                        </div>
                        <div className="flex flex-col items-start">
                            <button
                                onClick={handleImportClick}
                                className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold px-4 py-2 rounded-lg hover:bg-white shadow-sm"
                                title="Import financial records from CSV or JSON"
                            >
                                Import
                            </button>
                            <span className="text-xs text-slate-500 mt-1">Financial Records</span>
                        </div>
                        <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow-sm">Log out</button>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFileChange} />
                </div>
            </div>
        </header>
    );
};

export default Header;
