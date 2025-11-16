import React, { useRef } from 'react';
import type { CloudState, Settings } from '../types';

interface SettingsProps {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    cloud: CloudState;
    onExport: () => void;
    onImport: (file: File) => void;
}

const SettingsTab: React.FC<SettingsProps> = ({ settings, setSettings, cloud, onExport, onImport }) => {
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

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-purple-50 to-fuchsia-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Backup & Restore</h2>
                <div className="flex flex-wrap gap-3">
                    <button onClick={onExport} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg">Download Backup</button>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold px-4 py-2 rounded-lg hover:bg-white">Import Backup</button>
                    <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
                </div>
                <p className="text-sm text-slate-500">Backups contain financial records, members, users, settings, attendance data, and weekly history reports. Importing a backup overwrites current data.</p>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Supabase Sync Status</h2>
                <div className="border border-dashed border-emerald-200 rounded-xl p-4 bg-white/70 backdrop-blur">
                    <p className="font-semibold text-slate-700">{cloud.message || 'Supabase sync initialising…'}</p>
                    <p className="text-sm text-slate-500 mt-1">Connected: {cloud.signedIn ? 'Yes' : 'No'}</p>
                    <p className="text-sm text-slate-500">Ready: {cloud.ready ? 'Yes' : 'No'}</p>
                </div>
                <p className="text-xs text-slate-500">Supabase credentials are provided via environment variables when building the app.</p>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-sky-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Supabase Configuration</h2>
                <p className="text-sm text-slate-500">Define the Supabase project references used throughout the app. Table names must match the tables you created in Supabase.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Project URL</span>
                        <input
                            type="url"
                            value={settings.supabaseUrl}
                            onChange={e => handleChange('supabaseUrl', e.target.value)}
                            placeholder="https://your-project.supabase.co"
                            className="border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Entries Table</span>
                        <input
                            value={settings.supabaseEntriesTable}
                            onChange={e => handleChange('supabaseEntriesTable', e.target.value)}
                            placeholder="entries"
                            className="border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Members Table</span>
                        <input
                            value={settings.supabaseMembersTable}
                            onChange={e => handleChange('supabaseMembersTable', e.target.value)}
                            placeholder="members"
                            className="border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Weekly History Table</span>
                        <input
                            value={settings.supabaseHistoryTable}
                            onChange={e => handleChange('supabaseHistoryTable', e.target.value)}
                            placeholder="weekly_history"
                            className="border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </label>
                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-600">Tasks Table</span>
                        <input
                            value={settings.supabaseTasksTable}
                            onChange={e => handleChange('supabaseTasksTable', e.target.value)}
                            placeholder="tasks"
                            className="border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </label>
                </div>
                <p className="text-xs text-slate-500">Update <code className="font-mono">VITE_SUPABASE_URL</code> and <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in your environment to authorise API calls.</p>
            </section>
        </div>
    );
};

export default SettingsTab;
