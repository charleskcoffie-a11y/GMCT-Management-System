import React, { useRef } from 'react';
import type { CloudState, Settings } from '../types';

interface SettingsProps {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    cloud: CloudState;
    setCloud: React.Dispatch<React.SetStateAction<CloudState>>;
    onExport: () => void;
    onImport: (file: File) => void;
}

const SettingsTab: React.FC<SettingsProps> = ({ settings, setSettings, cloud, setCloud, onExport, onImport }) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        onImport(file);
        event.target.value = '';
    };

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-sky-50 to-indigo-100/70 p-6 space-y-4">
 codex/restore-missing-imports-for-app.tsx
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-sky-50 to-indigo-100/70 p-6 space-y-4">

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
main
                <h2 className="text-2xl font-bold text-slate-800">Application Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Currency</span>
                        <input value={settings.currency} onChange={e => handleChange('currency', e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2" />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Maximum Classes</span>
                        <input type="number" min={1} value={settings.maxClasses} onChange={e => handleChange('maxClasses', Number(e.target.value))} className="border border-slate-300 rounded-lg px-3 py-2" />
                    </label>
                    <label className="flex items-center gap-2 mt-6 md:mt-0">
                        <input type="checkbox" checked={settings.enforceDirectory} onChange={e => handleChange('enforceDirectory', e.target.checked)} />
                        <span className="text-sm text-slate-600">Require selecting members from directory</span>
                    </label>
                </div>
            </section>

 codex/restore-missing-imports-for-app.tsx
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-purple-50 to-fuchsia-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Backup & Restore</h2>
                <div className="flex flex-wrap gap-3">
                    <button onClick={onExport} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg">Download Backup</button>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold px-4 py-2 rounded-lg hover:bg-white">Import Backup</button>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Backup & Restore</h2>
                <div className="flex flex-wrap gap-3">
                    <button onClick={onExport} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg">Download Backup</button>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg hover:bg-slate-100">Import Backup</button>
 main
                    <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
                </div>
                <p className="text-sm text-slate-500">Backups contain financial records, members, users, settings and attendance data. Importing a backup overwrites current data.</p>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Cloud Sync Status</h2>
                <div className="border border-dashed border-emerald-200 rounded-xl p-4 bg-white/70 backdrop-blur">
 codex/restore-missing-imports-for-app.tsx
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Cloud Sync Status</h2>
                <div className="border border-dashed border-emerald-200 rounded-xl p-4 bg-white/70 backdrop-blur">

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Cloud Sync Status</h2>
                <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50">
 main
                    <p className="font-semibold text-slate-700">{cloud.message || 'Cloud sync initialising...'}</p>
                    <p className="text-sm text-slate-500 mt-1">Signed in: {cloud.signedIn ? 'Yes' : 'No'}</p>
                    {cloud.account && <p className="text-sm text-slate-500">Account: {cloud.account.username ?? 'Unknown account'}</p>}
                </div>
                <button onClick={() => setCloud(prev => ({ ...prev, message: 'Ready for manual sign-in.', ready: true }))} className="bg-white/80 border border-emerald-200 text-emerald-700 font-semibold px-4 py-2 rounded-lg hover:bg-white w-full md:w-auto">
 codex/restore-missing-imports-for-app.tsx
                <button onClick={() => setCloud(prev => ({ ...prev, message: 'Ready for manual sign-in.', ready: true }))} className="bg-white/80 border border-emerald-200 text-emerald-700 font-semibold px-4 py-2 rounded-lg hover:bg-white w-full md:w-auto">

                <button onClick={() => setCloud(prev => ({ ...prev, message: 'Ready for manual sign-in.', ready: true }))} className="bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg hover:bg-slate-100 w-full md:w-auto">
 main
                    Update Status
                </button>
            </section>
        </div>
    );
};

export default SettingsTab;
