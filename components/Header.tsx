import React, { useRef } from 'react';
import type { Entry, User } from '../types';
import { fromCsv, sanitizeEntry } from '../utils';

type HeaderProps = {
    entries: Entry[];
    onImport: (entries: Entry[]) => void;
    onExport: (format: 'csv' | 'json') => void;
    currentUser: User;
    onLogout: () => void;
};

const Header: React.FC<HeaderProps> = ({ entries, onImport, onExport, currentUser, onLogout }) => {
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
 codex/restore-missing-imports-for-app.tsx
        <header className="bg-gradient-to-br from-white via-indigo-50 to-sky-50 rounded-3xl shadow-lg border border-white/60 backdrop-blur p-6 sm:p-8 mb-6">

        <header className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 mb-6">
 main
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">GMCT Management System</h1>
                    <p className="text-slate-500">Welcome back, {currentUser.username}. You have {entries.length} financial entries stored locally.</p>
                </div>
                <div className="flex flex-wrap gap-3">
 codex/restore-missing-imports-for-app.tsx
                    <button onClick={() => onExport('csv')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm">Export CSV</button>
                    <button onClick={() => onExport('json')} className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded-lg shadow-sm">Export JSON</button>
                    <button onClick={handleImportClick} className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold px-4 py-2 rounded-lg hover:bg-white shadow-sm">Import</button>
                    <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow-sm">Log out</button>

                    <button onClick={() => onExport('csv')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg">Export CSV</button>
                    <button onClick={() => onExport('json')} className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded-lg">Export JSON</button>
                    <button onClick={handleImportClick} className="bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg hover:bg-slate-100">Import</button>
                    <button onClick={onLogout} className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg">Log out</button>
 main
                    <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFileChange} />
                </div>
            </div>
        </header>
    );
};

export default Header;
