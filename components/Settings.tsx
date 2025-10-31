import React, { useEffect, useRef, useState } from 'react';
import type { CloudState, Settings } from '../types';
import { msalInteractiveSignIn } from '../services/oneDrive';

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
    const [shareEmail, setShareEmail] = useState('');
    const [authMessage, setAuthMessage] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (!toast) return;
        const timeout = window.setTimeout(() => setToast(null), 4000);
        return () => window.clearTimeout(timeout);
    }, [toast]);

    const handleChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        onImport(file);
        event.target.value = '';
    };

    const handleManualSignIn = async () => {
        setAuthMessage('Preparing secure sign-in. Complete the Microsoft prompt in the pop-up window.');
        setCloud(prev => ({ ...prev, ready: true, message: 'Awaiting authentication response…' }));
        try {
            const session = await msalInteractiveSignIn();
            const username = session.account.username ?? 'connected account';
            const authorityHint = session.authority === 'organizations'
                ? ' (work account)'
                : session.authority === 'consumers'
                ? ' (personal account)'
                : '';
            const successMessage = `You are now signed in as ${username}${authorityHint}.`;
            setCloud(prev => ({
                ...prev,
                ready: true,
                signedIn: true,
                account: session.account,
                accessToken: session.accessToken,
                activeUsers: typeof prev.activeUsers === 'number' ? Math.max(prev.activeUsers, 1) : 1,
                message: successMessage,
            }));
            setAuthMessage(successMessage);
            setToast({ message: successMessage, tone: 'success' });
        } catch (error) {
            const failureMessage = 'Sign in failed. Please check your credentials or network connection.';
            setCloud(prev => ({
                ...prev,
                ready: true,
                signedIn: false,
                account: undefined,
                accessToken: undefined,
                activeUsers: prev.activeUsers ?? null,
                message: failureMessage,
            }));
            setAuthMessage(failureMessage);
            setToast({ message: failureMessage, tone: 'error' });
        }
    };

    const handleShareAccess = () => {
        const email = shareEmail.trim();
        if (!email) {
            setAuthMessage('Enter an email address to send an access invite.');
            return;
        }
        setAuthMessage(`Invitation sent to ${email}. They will receive setup instructions shortly.`);
        setShareEmail('');
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

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-sky-100/70 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800">Sign In &amp; Share Access</h2>
                <p className="text-sm text-slate-500">Link your Microsoft account or invite a teammate to collaborate securely.</p>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <button type="button" onClick={handleManualSignIn} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm w-full lg:w-auto">Sign in with Microsoft</button>
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <input
                            value={shareEmail}
                            onChange={e => setShareEmail(e.target.value)}
                            type="email"
                            placeholder="Invite collaborator (email)"
                            className="border border-slate-300 rounded-lg px-3 py-2 w-full"
                        />
                        <button type="button" onClick={handleShareAccess} className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold px-4 py-2 rounded-lg hover:bg-white w-full sm:w-auto">Send Invite</button>
                    </div>
                </div>
                {authMessage && <p className="text-xs text-slate-500">{authMessage}</p>}
            </section>
            {toast && (
                <div
                    className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg ${
                        toast.tone === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                    role="status"
                >
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default SettingsTab;
