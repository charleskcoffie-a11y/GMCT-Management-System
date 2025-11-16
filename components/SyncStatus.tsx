import React, { useMemo } from 'react';

interface SyncStatusProps {
    isOffline: boolean;
    syncMessage: string | null;
    lastSyncedAt: number | null;
    lastAttendanceSavedAt: number | null;
    activeSyncTasks: number;
    cloudReady: boolean;
    cloudSignedIn: boolean;
    onManualSync: () => void;
    manualSyncBusy: boolean;
}

const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(timestamp));
};

const SyncStatus: React.FC<SyncStatusProps> = ({
    isOffline,
    syncMessage,
    lastSyncedAt,
    lastAttendanceSavedAt,
    activeSyncTasks,
    cloudReady,
    cloudSignedIn,
    onManualSync,
    manualSyncBusy,
}) => {
    const statusTone = useMemo(() => {
        if (isOffline) return 'bg-rose-100 text-rose-700 border-rose-200';
        if (activeSyncTasks > 0) return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }, [isOffline, activeSyncTasks]);

    return (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition-colors ${statusTone}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p>{isOffline ? 'Offline mode: changes will sync when you reconnect.' : syncMessage ?? 'All systems ready. Data is up to date.'}</p>
                    <div className="text-xs font-normal text-slate-600">
                        <p>Financial records last synced: <span className="font-semibold text-slate-700">{formatTimestamp(lastSyncedAt)}</span></p>
                        <p>Attendance last saved: <span className="font-semibold text-slate-700">{formatTimestamp(lastAttendanceSavedAt)}</span></p>
                    </div>
                </div>
                <div className="flex flex-col items-stretch sm:items-end gap-2 text-xs font-medium text-slate-600">
                    <div className="space-y-1 text-right">
                        <p>Status: {cloudReady ? (cloudSignedIn ? 'Connected to Supabase' : 'Supabase not configured') : 'Initialising Supabase'}</p>
                        <p>{activeSyncTasks > 0 ? `Syncing ${activeSyncTasks} task${activeSyncTasks > 1 ? 's' : ''}…` : 'No background sync running'}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onManualSync}
                        disabled={manualSyncBusy}
                        className="inline-flex items-center justify-center rounded-xl border border-indigo-400/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {manualSyncBusy ? 'Syncing…' : 'Sync Now'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SyncStatus;
