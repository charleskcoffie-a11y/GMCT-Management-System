import React, { useEffect, useRef, useState } from 'react';
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
    const [siteUrlInput, setSiteUrlInput] = useState(settings.sharePointSiteUrl);
    const [entriesListInput, setEntriesListInput] = useState(settings.sharePointEntriesListName);
    const [membersListInput, setMembersListInput] = useState(settings.sharePointMembersListName);
    const [historyListInput, setHistoryListInput] = useState(settings.sharePointHistoryListName);
    const [sharePointStatus, setSharePointStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

    const handleChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        setSiteUrlInput(settings.sharePointSiteUrl);
        setEntriesListInput(settings.sharePointEntriesListName);
        setMembersListInput(settings.sharePointMembersListName);
        setHistoryListInput(settings.sharePointHistoryListName);
    }, [
        settings.sharePointSiteUrl,
        settings.sharePointEntriesListName,
        settings.sharePointMembersListName,
        settings.sharePointHistoryListName,
    ]);

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

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-sky-50 to-cyan-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">SharePoint Storage</h2>
                <p className="text-sm text-slate-500">Point every module at the same site and lists so members, finances, and weekly history stay in sync.</p>
                <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-slate-600">Site URL</span>
                    <input
                        value={siteUrlInput}
                        onChange={event => {
                            setSiteUrlInput(event.target.value);
                            setSharePointStatus(null);
                        }}
                        placeholder="https://yourtenant.sharepoint.com/sites/GMCT"
                        className="border border-slate-300 rounded-lg px-3 py-2"
                    />
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Finance list name</span>
                        <input
                            value={entriesListInput}
                            onChange={event => {
                                setEntriesListInput(event.target.value);
                                setSharePointStatus(null);
                            }}
                            placeholder="Finance_Records"
                            className="border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Members list name</span>
                        <input
                            value={membersListInput}
                            onChange={event => {
                                setMembersListInput(event.target.value);
                                setSharePointStatus(null);
                            }}
                            placeholder="Members_DataBase"
                            className="border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </label>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-600">Weekly history list name</span>
                        <input
                            value={historyListInput}
                            onChange={event => {
                                setHistoryListInput(event.target.value);
                                setSharePointStatus(null);
                            }}
                            placeholder="Weekly_Service_History"
                            className="border border-slate-300 rounded-lg px-3 py-2"
                        />
                    </label>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => {
                            const site = siteUrlInput.trim();
                            const entries = entriesListInput.trim();
                            const members = membersListInput.trim();
                            const history = historyListInput.trim() || settings.sharePointHistoryListName;
                            if (!site || !entries || !members) {
                                setSharePointStatus({ tone: 'error', text: 'Site URL, Finance list, and Members list are required.' });
                                return;
                            }
                            setSettings(prev => ({
                                ...prev,
                                sharePointSiteUrl: site,
                                sharePointEntriesListName: entries,
                                sharePointMembersListName: members,
                                sharePointHistoryListName: history,
                            }));
                            setSharePointStatus({ tone: 'success', text: 'Saved. Utilities and sync will use this location from now on.' });
                        }}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2 rounded-lg"
                    >
                        Save SharePoint location
                    </button>
                    {settings.sharePointSiteUrl && (
                        <button
                            type="button"
                            onClick={() => window.open(settings.sharePointSiteUrl, '_blank', 'noopener')}
                            className="bg-white/80 border border-cyan-200 text-cyan-700 font-semibold px-4 py-2 rounded-lg hover:bg-white"
                        >
                            Open current site
                        </button>
                    )}
                </div>
                {sharePointStatus && (
                    <p className={`text-sm font-medium ${sharePointStatus.tone === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {sharePointStatus.text}
                    </p>
                )}
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-purple-50 to-fuchsia-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Backup & Restore</h2>
                <div className="flex flex-wrap gap-3">
                    <button onClick={onExport} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg">Download Backup</button>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold px-4 py-2 rounded-lg hover:bg-white">Import Backup</button>
                    <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
                </div>
                <p className="text-sm text-slate-500">Backups contain financial records, members, users, settings and attendance data. Importing a backup overwrites current data.</p>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Cloud Sync Status</h2>
                <div className="border border-dashed border-emerald-200 rounded-xl p-4 bg-white/70 backdrop-blur">
                    <p className="font-semibold text-slate-700">{cloud.message || 'Cloud sync initialising...'}</p>
                    <p className="text-sm text-slate-500 mt-1">Signed in: {cloud.signedIn ? 'Yes' : 'No'}</p>
                    {cloud.account && <p className="text-sm text-slate-500">Account: {cloud.account.username ?? 'Unknown account'}</p>}
                </div>
                <button onClick={() => setCloud(prev => ({ ...prev, message: 'Ready for manual sign-in.', ready: true }))} className="bg-white/80 border border-emerald-200 text-emerald-700 font-semibold px-4 py-2 rounded-lg hover:bg-white w-full md:w-auto">
                    Update Status
                </button>
            </section>
        </div>
    );
};

export default SettingsTab;
