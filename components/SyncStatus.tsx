import React, { useMemo } from 'react';

interface SyncStatusProps {
    isOffline: boolean;
    syncMessage: string | null;
    lastSyncedAt: number | null;
    lastAttendanceSavedAt: number | null;
    activeSyncTasks: number;
    cloudReady: boolean;
    cloudSignedIn: boolean;
}

const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(timestamp));
};

const SyncStatus: React.FC<SyncStatusProps> = ({ isOffline, syncMessage, lastSyncedAt, lastAttendanceSavedAt, activeSyncTasks, cloudReady, cloudSignedIn }) => {
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
                <div className="text-xs font-medium text-slate-600 space-y-1 text-right">
                    <p>Status: {cloudReady ? (cloudSignedIn ? 'Connected' : 'Ready to sign in') : 'Initialising'}</p>
                    <p>{activeSyncTasks > 0 ? `Syncing ${activeSyncTasks} task${activeSyncTasks > 1 ? 's' : ''}…` : 'No background sync running'}</p>
                </div>
            </div>
        </div>
    );
};

export default SyncStatus;
