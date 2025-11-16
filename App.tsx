// App.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Members from './components/Members';
import Insights from './components/Insights';
import SettingsTab from './components/Settings';
import Login from './components/Login';
import UsersTab from './components/Users';
import AdminLandingPage from './components/AdminLandingPage';
import Attendance from './components/Attendance';
import AdminAttendanceView from './components/AdminAttendanceView';
import Utilities from './components/Utilities';
import EntryModal from './components/EntryModal';
import WeeklyHistory from './components/WeeklyHistory';
import ConfirmationModal from './components/ConfirmationModal';
import SyncStatus from './components/SyncStatus';
import TasksTab from './components/TasksTab';

import { useLocalStorage } from './hooks/useLocalStorage';
import {
    sanitizeEntry,
    sanitizeMember,
    sanitizeUser,
    sanitizeSettings,
    formatCurrency,
    sanitizeWeeklyHistoryRecord,
    sanitizeEntriesCollection,
    sanitizeMembersCollection,
    sanitizeUsersCollection,
    sanitizeAttendanceCollection,
    sanitizeWeeklyHistoryCollection,
    sanitizeString,
    ENTRY_TYPE_VALUES,
    entryTypeLabel,
    generateId,
    fromCsv,
    toCsv,
} from './utils';
import type {
    Entry,
    Member,
    Settings,
    User,
    Tab,
    CloudState,
    AttendanceRecord,
    EntryType,
    WeeklyHistoryRecord,
    UserRole,
} from './types';
import { msalSilentSignIn } from './services/oneDrive';
import {
    loadEntriesFromSharePoint,
    loadMembersFromSharePoint,
    loadWeeklyHistoryFromSharePoint,
    upsertEntryToSharePoint,
    deleteEntryFromSharePoint,
    upsertMemberToSharePoint,
    deleteMemberFromSharePoint,
    upsertWeeklyHistoryToSharePoint,
    deleteWeeklyHistoryFromSharePoint,
    resetContextCache,
} from './services/sharepoint';
import { clearAllTaskData } from './services/tasksStorage';
import {
    DEFAULT_CURRENCY,
    DEFAULT_MAX_CLASSES,
    DEFAULT_SHAREPOINT_SITE_URL,
    DEFAULT_SHAREPOINT_ENTRIES_LIST_NAME,
    DEFAULT_SHAREPOINT_MEMBERS_LIST_NAME,
    DEFAULT_SHAREPOINT_HISTORY_LIST_NAME,
    DEFAULT_SHAREPOINT_TASKS_LIST_NAME,
    MANUAL_SYNC_EVENT,
} from './constants';

// Initial Data
const INITIAL_USERS: User[] = [
    { username: 'Admin', password: 'GMCT', role: 'admin' },
    { username: 'FinanceUser', password: 'password', role: 'finance' },
    { username: 'ClassLeader1', password: 'password', role: 'class-leader', classLed: '1' },
    { username: 'Statistician', password: 'Stats', role: 'statistician' },
];
const INITIAL_SETTINGS: Settings = {
    currency: DEFAULT_CURRENCY,
    maxClasses: DEFAULT_MAX_CLASSES,
    enforceDirectory: true,
    sharePointSiteUrl: DEFAULT_SHAREPOINT_SITE_URL,
    sharePointEntriesListName: DEFAULT_SHAREPOINT_ENTRIES_LIST_NAME,
    sharePointMembersListName: DEFAULT_SHAREPOINT_MEMBERS_LIST_NAME,
    sharePointHistoryListName: DEFAULT_SHAREPOINT_HISTORY_LIST_NAME,
    sharePointTasksListName: DEFAULT_SHAREPOINT_TASKS_LIST_NAME,
};

// Define the keys we can sort the financial records table by
type SortKey = 'date' | 'memberName' | 'type' | 'amount' | 'classNumber';

const PRESENCE_STORAGE_KEY = 'gmct-presence';
const PRESENCE_TIMEOUT_MS = 60_000;

declare global {
    interface Window {
        handleRecordImportClick?: () => void;
    }
}

const App: React.FC = () => {
    // --- State Management ---
    const [entries, setEntries] = useLocalStorage<Entry[]>('gmct-entries', [], (data) => Array.isArray(data) ? data.map(sanitizeEntry) : []);
    const [members, setMembers] = useLocalStorage<Member[]>('gmct-members', [], (data) => Array.isArray(data) ? data.map(sanitizeMember) : []);
    const [users, setUsers] = useLocalStorage<User[]>('gmct-users', INITIAL_USERS, (data) => Array.isArray(data) && data.length > 0 ? data.map(sanitizeUser) : INITIAL_USERS);
    const [settings, setSettings] = useLocalStorage<Settings>('gmct-settings', INITIAL_SETTINGS, sanitizeSettings);
    const [attendance, setAttendance] = useLocalStorage<AttendanceRecord[]>('gmct-attendance', [], (data) => Array.isArray(data) ? data : []);
    const [weeklyHistory, setWeeklyHistory] = useLocalStorage<WeeklyHistoryRecord[]>('gmct-weekly-history', [], (data) => Array.isArray(data) ? data.map(sanitizeWeeklyHistoryRecord) : []);
    
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('home');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [entryToDeleteId, setEntryToDeleteId] = useState<string | null>(null);
    const [isFinanceImportConfirmOpen, setIsFinanceImportConfirmOpen] = useState(false);
    const [financeToast, setFinanceToast] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
    const [, setIsNavOpen] = useState(false);
    const [lastAttendanceSavedAt, setLastAttendanceSavedAt] = useState<number | null>(null);
    const [isOffline, setIsOffline] = useState<boolean>(() => {
        if (typeof navigator === 'undefined') return false;
        return !navigator.onLine;
    });
    const [shouldResync, setShouldResync] = useState(0);
    const [activeSyncTasks, setActiveSyncTasks] = useState(0);
    const [recordsDataSource, setRecordsDataSource] = useState<'sharepoint' | 'local'>('local');
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [activeUserCount, setActiveUserCount] = useState<number | null>(null);
    
    // -- Sorting & Filtering State for Financial Records --
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [searchFilter, setSearchFilter] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');


    const [cloud, setCloud] = useState<CloudState>({ ready: false, signedIn: false, message: '' });

    const syncTaskCountRef = useRef(0);
    const entrySyncRef = useRef(new Map<string, { signature: string; entry: Entry }>());
    const memberSyncRef = useRef(new Map<string, { signature: string; member: Member }>());
    const historySyncRef = useRef(new Map<string, { signature: string; record: WeeklyHistoryRecord }>());
    const presenceIntervalRef = useRef<number | null>(null);
    const presenceStateRef = useRef<{ id: string | null }>({ id: null });
    const financeImportInputRef = useRef<HTMLInputElement | null>(null);

    const getStoredPresenceId = useCallback((): string | null => {
        if (typeof window === 'undefined') {
            return null;
        }
        return window.sessionStorage.getItem('gmct-presence-id');
    }, []);

    const setStoredPresenceId = useCallback((id: string | null) => {
        if (typeof window === 'undefined') {
            return;
        }
        if (id) {
            window.sessionStorage.setItem('gmct-presence-id', id);
        } else {
            window.sessionStorage.removeItem('gmct-presence-id');
        }
    }, []);

    const beginSync = useCallback(() => {
        syncTaskCountRef.current += 1;
        setActiveSyncTasks(syncTaskCountRef.current);
    }, []);

    const endSync = useCallback(() => {
        syncTaskCountRef.current = Math.max(0, syncTaskCountRef.current - 1);
        setActiveSyncTasks(syncTaskCountRef.current);
    }, []);

    const computeEntrySignature = useCallback((entry: Entry) => {
        const sanitized = sanitizeEntry(entry);
        return JSON.stringify({
            id: sanitized.id,
            spId: sanitized.spId ?? null,
            date: sanitized.date,
            memberID: sanitized.memberID,
            memberName: sanitized.memberName,
            type: sanitized.type,
            fund: sanitized.fund,
            method: sanitized.method,
            amount: sanitized.amount,
            note: sanitized.note ?? '',
        });
    }, []);

    const computeMemberSignature = useCallback((member: Member) => {
        const sanitized = sanitizeMember(member);
        return JSON.stringify({
            id: sanitized.id,
            spId: sanitized.spId ?? null,
            name: sanitized.name,
            classNumber: sanitized.classNumber ?? '',
        });
    }, []);

    const computeWeeklyHistorySignature = useCallback((record: WeeklyHistoryRecord) => {
        const sanitized = sanitizeWeeklyHistoryRecord(record);
        return JSON.stringify(sanitized);
    }, []);

    const mergeEntriesFromCloud = useCallback((localEntries: Entry[], remoteEntries: Entry[]) => {
        const sanitizedRemote = remoteEntries.map(remote => sanitizeEntry(remote));
        const remoteMap = new Map(sanitizedRemote.map(remote => [remote.id, remote]));

        const merged = localEntries.map(local => {
            const remote = remoteMap.get(local.id);
            if (remote) {
                remoteMap.delete(local.id);
                return { ...local, ...remote };
            }
            return local;
        });

        for (const remote of remoteMap.values()) {
            merged.push(remote);
        }

        const cache = entrySyncRef.current;
        cache.clear();
        for (const entry of merged) {
            const sanitized = sanitizeEntry(entry);
            cache.set(sanitized.id, { signature: computeEntrySignature(sanitized), entry: sanitized });
        }

        return merged;
    }, [computeEntrySignature]);

    const mergeMembersFromCloud = useCallback((localMembers: Member[], remoteMembers: Member[]) => {
        const sanitizedRemote = remoteMembers.map(remote => sanitizeMember(remote));
        const remoteMap = new Map(sanitizedRemote.map(remote => [remote.id, remote]));

        const merged = localMembers.map(local => {
            const remote = remoteMap.get(local.id);
            if (remote) {
                remoteMap.delete(local.id);
                return { ...local, ...remote };
            }
            return local;
        });

        for (const remote of remoteMap.values()) {
            merged.push(remote);
        }

        const cache = memberSyncRef.current;
        cache.clear();
        for (const member of merged) {
            const sanitized = sanitizeMember(member);
            cache.set(sanitized.id, { signature: computeMemberSignature(sanitized), member: sanitized });
        }

        return merged;
    }, [computeMemberSignature]);

    const mergeWeeklyHistoryFromCloud = useCallback((localHistory: WeeklyHistoryRecord[], remoteHistory: WeeklyHistoryRecord[]) => {
        const sanitizedRemote = remoteHistory.map(remote => sanitizeWeeklyHistoryRecord(remote));
        const remoteMap = new Map(sanitizedRemote.map(remote => [remote.id, remote]));

        const merged = localHistory.map(local => {
            const remote = remoteMap.get(local.id);
            if (remote) {
                remoteMap.delete(local.id);
                return { ...local, ...remote };
            }
            return local;
        });

        for (const remote of remoteMap.values()) {
            merged.push(remote);
        }

        const cache = historySyncRef.current;
        cache.clear();
        for (const record of merged) {
            const sanitized = sanitizeWeeklyHistoryRecord(record);
            cache.set(sanitized.id, { signature: computeWeeklyHistorySignature(sanitized), record: sanitized });
        }

        return merged;
    }, [computeWeeklyHistorySignature]);

    const readPresenceMap = useCallback((): Record<string, number> => {
        if (typeof window === 'undefined') {
            return {};
        }
        try {
            const raw = window.localStorage.getItem(PRESENCE_STORAGE_KEY);
            if (!raw) {
                return {};
            }
            const parsed = JSON.parse(raw) as Record<string, number>;
            if (!parsed || typeof parsed !== 'object') {
                return {};
            }
            const now = Date.now();
            const fresh: Record<string, number> = {};
            let mutated = false;
            for (const [key, value] of Object.entries(parsed)) {
                if (typeof value === 'number' && now - value < PRESENCE_TIMEOUT_MS) {
                    fresh[key] = value;
                } else {
                    mutated = true;
                }
            }
            if (mutated) {
                window.localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(fresh));
            }
            return fresh;
        } catch (error) {
            console.warn('Unable to read presence map.', error);
            return {};
        }
    }, []);

    const updatePresenceCount = useCallback(() => {
        if (typeof window === 'undefined') {
            setActiveUserCount(null);
            return;
        }
        const map = readPresenceMap();
        setActiveUserCount(Object.keys(map).length);
    }, [readPresenceMap]);

    const touchPresence = useCallback((id: string) => {
        if (!id || typeof window === 'undefined') {
            return;
        }
        try {
            const map = readPresenceMap();
            map[id] = Date.now();
            window.localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(map));
            setActiveUserCount(Object.keys(map).length);
        } catch (error) {
            console.error('Failed to update presence heartbeat', error);
            setActiveUserCount(null);
        }
    }, [readPresenceMap]);

    const removePresenceRecord = useCallback((id: string | null) => {
        if (!id || typeof window === 'undefined') {
            return;
        }
        try {
            const map = readPresenceMap();
            if (map[id]) {
                delete map[id];
                window.localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(map));
                setActiveUserCount(Object.keys(map).length);
            }
        } catch (error) {
            console.error('Failed to clear presence record', error);
        }
    }, [readPresenceMap]);

    useEffect(() => {
        const attemptSilentSignin = async () => {
            const session = await msalSilentSignIn();
            if (session) {
                setCloud({ ready: true, signedIn: true, account: session.account, accessToken: session.accessToken, message: 'Signed in silently.' });
            } else {
                setCloud({ ready: true, signedIn: false, message: 'Ready for manual sign-in.' });
            }
        };
        attemptSilentSignin();
    }, []);

    useEffect(() => {
        setIsNavOpen(false);
    }, [activeTab]);

    useEffect(() => {
        if (!financeToast) return;
        if (typeof window === 'undefined') return;
        const timer = window.setTimeout(() => setFinanceToast(null), 6000);
        return () => window.clearTimeout(timer);
    }, [financeToast]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleOffline = () => {
            setIsOffline(true);
            setSyncMessage('Offline: changes will sync when connection returns.');
            setActiveSyncTasks(0);
            setRecordsDataSource('local');
        };
        const handleOnline = () => {
            setIsOffline(false);
            setSyncMessage('Connection restored. Syncing latest updates…');
            setShouldResync(prev => prev + 1);
        };
        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const tick = () => setCurrentDate(new Date());
        const interval = window.setInterval(tick, 60_000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (attendance.length === 0) return;
        setLastAttendanceSavedAt(prev => (prev === null ? Date.now() : prev));
    }, [attendance]);

    useEffect(() => {
        if (!currentUser) {
            if (typeof window !== 'undefined') {
                const id = presenceStateRef.current.id ?? getStoredPresenceId();
                if (id) {
                    removePresenceRecord(id);
                }
                if (presenceIntervalRef.current !== null) {
                    window.clearInterval(presenceIntervalRef.current);
                    presenceIntervalRef.current = null;
                }
                setStoredPresenceId(null);
            }
            presenceStateRef.current.id = null;
            setActiveUserCount(null);
            return;
        }

        if (typeof window === 'undefined') {
            return;
        }

        const ensurePresence = () => {
            let presenceId = presenceStateRef.current.id ?? getStoredPresenceId();
            if (!presenceId) {
                presenceId = generateId('presence');
            }
            presenceStateRef.current.id = presenceId;
            setStoredPresenceId(presenceId);
            touchPresence(presenceId);
        };

        ensurePresence();
        updatePresenceCount();

        const interval = window.setInterval(ensurePresence, 30_000);
        presenceIntervalRef.current = interval;

        const handleVisibility = () => {
            if (!document.hidden) {
                ensurePresence();
            }
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === PRESENCE_STORAGE_KEY) {
                updatePresenceCount();
            }
        };

        const handleBeforeUnload = () => {
            const id = presenceStateRef.current.id ?? getStoredPresenceId();
            if (id) {
                removePresenceRecord(id);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('storage', handleStorage);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (presenceIntervalRef.current !== null) {
                window.clearInterval(presenceIntervalRef.current);
                presenceIntervalRef.current = null;
            }
            const id = presenceStateRef.current.id ?? getStoredPresenceId();
            if (id) {
                removePresenceRecord(id);
            }
            setStoredPresenceId(null);
            presenceStateRef.current.id = null;
        };
    }, [currentUser, getStoredPresenceId, removePresenceRecord, setStoredPresenceId, touchPresence, updatePresenceCount]);

    useEffect(() => {
        if (!cloud.signedIn || !cloud.accessToken) {
            entrySyncRef.current.clear();
            memberSyncRef.current.clear();
            historySyncRef.current.clear();
            resetContextCache();
            setSyncMessage(null);
            setLastSyncedAt(null);
            setActiveSyncTasks(0);
            setRecordsDataSource('local');
            return;
        }

        if (isOffline) {
            setSyncMessage('Offline: changes will sync when connection returns.');
            setRecordsDataSource('local');
            return;
        }

        let active = true;

        const hydrateFromSharePoint = async () => {
            beginSync();
            try {
                const historyListName = settings.sharePointHistoryListName || DEFAULT_SHAREPOINT_HISTORY_LIST_NAME;
                const [remoteEntries, remoteMembers, remoteHistory] = await Promise.all([
                    loadEntriesFromSharePoint(cloud.accessToken!),
                    loadMembersFromSharePoint(cloud.accessToken!),
                    loadWeeklyHistoryFromSharePoint(cloud.accessToken!, historyListName),
                ]);
                if (!active) return;
                setEntries(prev => mergeEntriesFromCloud(prev, remoteEntries));
                setMembers(prev => mergeMembersFromCloud(prev, remoteMembers));
                setWeeklyHistory(prev => mergeWeeklyHistoryFromCloud(prev, remoteHistory));
                setSyncMessage(null);
                setLastSyncedAt(Date.now());
                setRecordsDataSource('sharepoint');
            } catch (error) {
                if (!active) return;
                console.error('Initial SharePoint sync failed', error);
                setSyncMessage(error instanceof Error ? error.message : 'Unable to sync with SharePoint right now.');
                setRecordsDataSource('local');
            } finally {
                if (active) {
                    endSync();
                }
            }
        };

        hydrateFromSharePoint();

        return () => {
            active = false;
        };
    }, [cloud.signedIn, cloud.accessToken, mergeEntriesFromCloud, mergeMembersFromCloud, mergeWeeklyHistoryFromCloud, isOffline, shouldResync, settings.sharePointHistoryListName]);

    useEffect(() => {
        if (!cloud.signedIn || !cloud.accessToken || isOffline) {
            return;
        }

        let active = true;

        const pushEntryChanges = async () => {
            beginSync();
            const known = entrySyncRef.current;
            const currentMap = new Map(entries.map(entry => [entry.id, entry]));
            const entriesSnapshot: Array<[string, { signature: string; entry: Entry }]> = Array.from(known.entries());

            for (const [id, stored] of entriesSnapshot) {
                if (!currentMap.has(id)) {
                    if (stored.entry.spId) {
                        try {
                            await deleteEntryFromSharePoint(stored.entry, cloud.accessToken!);
                        } catch (error) {
                            console.error('Failed to remove SharePoint entry', error);
                        }
                    }
                    known.delete(id);
                }
            }

            try {
                for (const entry of entries) {
                    const sanitized = sanitizeEntry(entry);
                    sanitized.spId = entry.spId;
                    const signature = computeEntrySignature(sanitized);
                    const cached = known.get(sanitized.id);
                    if (!cached || cached.signature !== signature) {
                        try {
                            const spId = await upsertEntryToSharePoint(sanitized, cloud.accessToken!);
                            if (!active) return;
                            const updatedEntry = { ...sanitized, spId: spId ?? sanitized.spId };
                            known.set(updatedEntry.id, { signature: computeEntrySignature(updatedEntry), entry: updatedEntry });
                            if (spId && sanitized.spId !== spId) {
                                setEntries(prev => prev.map(existing => existing.id === updatedEntry.id ? { ...existing, spId } : existing));
                            }
                            setSyncMessage(null);
                            setLastSyncedAt(Date.now());
                        } catch (error) {
                            if (!active) return;
                            console.error('Failed to sync entry to SharePoint', error);
                            setSyncMessage('Unable to upload some financial entries to SharePoint. They remain saved locally.');
                        }
                    }
                }
            } finally {
                if (active) {
                    endSync();
                }
            }
        };

        pushEntryChanges();

        return () => {
            active = false;
        };
    }, [entries, cloud.signedIn, cloud.accessToken, computeEntrySignature, setEntries, isOffline, shouldResync]);

    useEffect(() => {
        if (!cloud.signedIn || !cloud.accessToken || isOffline) {
            return;
        }

        let active = true;

        const pushMemberChanges = async () => {
            beginSync();
            const known = memberSyncRef.current;
            const currentMap = new Map(members.map(member => [member.id, member]));
            const membersSnapshot: Array<[string, { signature: string; member: Member }]> = Array.from(known.entries());

            for (const [id, stored] of membersSnapshot) {
                if (!currentMap.has(id)) {
                    if (stored.member.spId) {
                        try {
                            await deleteMemberFromSharePoint(stored.member, cloud.accessToken!);
                        } catch (error) {
                            console.error('Failed to remove SharePoint member', error);
                        }
                    }
                    known.delete(id);
                }
            }

            try {
                for (const member of members) {
                    const sanitized = sanitizeMember(member);
                    sanitized.spId = member.spId;
                    const signature = computeMemberSignature(sanitized);
                    const cached = known.get(sanitized.id);
                    if (!cached || cached.signature !== signature) {
                        try {
                            const spId = await upsertMemberToSharePoint(sanitized, cloud.accessToken!);
                            if (!active) return;
                            const updatedMember = { ...sanitized, spId: spId ?? sanitized.spId };
                            known.set(updatedMember.id, { signature: computeMemberSignature(updatedMember), member: updatedMember });
                            if (spId && sanitized.spId !== spId) {
                                setMembers(prev => prev.map(existing => existing.id === updatedMember.id ? { ...existing, spId } : existing));
                            }
                            setSyncMessage(null);
                            setLastSyncedAt(Date.now());
                        } catch (error) {
                            if (!active) return;
                            console.error('Failed to sync member to SharePoint', error);
                            setSyncMessage('Unable to sync some members to SharePoint. Data remains saved locally.');
                        }
                    }
                }
            } finally {
                if (active) {
                    endSync();
                }
            }
        };

        pushMemberChanges();

        return () => {
            active = false;
        };
    }, [members, cloud.signedIn, cloud.accessToken, computeMemberSignature, setMembers, isOffline, shouldResync]);

    useEffect(() => {
        if (!cloud.signedIn || !cloud.accessToken || isOffline) {
            return;
        }

        let active = true;
        const listName = settings.sharePointHistoryListName || DEFAULT_SHAREPOINT_HISTORY_LIST_NAME;

        const pushHistoryChanges = async () => {
            beginSync();
            const known = historySyncRef.current;
            const currentMap = new Map(weeklyHistory.map(record => [record.id, record]));
            const snapshot: Array<[string, { signature: string; record: WeeklyHistoryRecord }]> = Array.from(known.entries());

            for (const [id, stored] of snapshot) {
                if (!currentMap.has(id)) {
                    if (stored.record.spId) {
                        try {
                            await deleteWeeklyHistoryFromSharePoint(stored.record, cloud.accessToken!, listName);
                        } catch (error) {
                            console.error('Failed to remove SharePoint weekly history record', error);
                        }
                    }
                    known.delete(id);
                }
            }

            try {
                for (const record of weeklyHistory) {
                    const sanitized = sanitizeWeeklyHistoryRecord(record);
                    sanitized.spId = record.spId;
                    const signature = computeWeeklyHistorySignature(sanitized);
                    const cached = known.get(sanitized.id);
                    if (!cached || cached.signature !== signature) {
                        try {
                            const spId = await upsertWeeklyHistoryToSharePoint(sanitized, cloud.accessToken!, listName);
                            if (!active) return;
                            const updated = { ...sanitized, spId: spId ?? sanitized.spId };
                            known.set(updated.id, { signature: computeWeeklyHistorySignature(updated), record: updated });
                            if (spId && sanitized.spId !== spId) {
                                setWeeklyHistory(prev => prev.map(existing => existing.id === updated.id ? { ...existing, spId } : existing));
                            }
                            setSyncMessage(null);
                            setLastSyncedAt(Date.now());
                        } catch (error) {
                            if (!active) return;
                            console.error('Failed to sync weekly history to SharePoint', error);
                            setSyncMessage('Unable to sync some weekly history records to SharePoint. They remain saved locally.');
                        }
                    }
                }
            } finally {
                if (active) {
                    endSync();
                }
            }
        };

        pushHistoryChanges();

        return () => {
            active = false;
        };
    }, [weeklyHistory, cloud.signedIn, cloud.accessToken, computeWeeklyHistorySignature, isOffline, shouldResync, settings.sharePointHistoryListName]);

    // --- Derived State ---
    const membersMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

    const filteredAndSortedEntries = useMemo(() => {
        // 1. Filter the entries
        const filtered = entries.filter(entry => {
            if (searchFilter) {
                const query = searchFilter.toLowerCase();
                const member = membersMap.get(entry.memberID);
                const matchesName = entry.memberName.toLowerCase().includes(query);
                const matchesId = entry.memberID.toLowerCase().includes(query);
                const matchesDirectoryName = member ? member.name.toLowerCase().includes(query) : false;
                if (!matchesName && !matchesId && !matchesDirectoryName) return false;
            }
            if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
            if (startDateFilter && entry.date < startDateFilter) return false;
            if (endDateFilter && entry.date > endDateFilter) return false;

            const member = membersMap.get(entry.memberID);
            if (classFilter !== 'all' && (!member || member.classNumber !== classFilter)) return false;
            
            return true;
        });

        // 2. Sort the filtered results
        const sortableEntries = [...filtered];
        sortableEntries.sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;

            if (sortConfig.key === 'classNumber') {
                const memberA = membersMap.get(a.memberID);
                const memberB = membersMap.get(b.memberID);
                aValue = parseInt(memberA?.classNumber || '0', 10) || 0;
                bValue = parseInt(memberB?.classNumber || '0', 10) || 0;
            } else {
                aValue = a[sortConfig.key as keyof Entry];
                bValue = b[sortConfig.key as keyof Entry];
            }
            
            let comparison = 0;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            } else if (aValue < bValue) {
                comparison = -1;
            } else if (aValue > bValue) {
                comparison = 1;
            }

            const result = comparison * (sortConfig.direction === 'asc' ? 1 : -1);

            // Secondary sort by date if primary keys are equal
            if (result === 0 && sortConfig.key !== 'date') {
                return b.date.localeCompare(a.date);
            }

            return result;
        });
        return sortableEntries;
    }, [entries, sortConfig, membersMap, searchFilter, classFilter, typeFilter, startDateFilter, endDateFilter]);

    const filteredTotalAmount = useMemo(() => {
        return filteredAndSortedEntries.reduce((sum, entry) => sum + entry.amount, 0);
    }, [filteredAndSortedEntries]);

    const dateFilterLabel = useMemo(() => {
        const formatDate = (value: string) => {
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime())
                ? value
                : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        };

        if (startDateFilter && endDateFilter) {
            return `${formatDate(startDateFilter)} – ${formatDate(endDateFilter)}`;
        }
        if (startDateFilter) {
            return `From ${formatDate(startDateFilter)}`;
        }
        if (endDateFilter) {
            return `Through ${formatDate(endDateFilter)}`;
        }
        return 'All dates';
    }, [startDateFilter, endDateFilter]);

    const filtersSummary = useMemo(() => {
        const parts: string[] = [`Date: ${dateFilterLabel}`];
        if (typeFilter !== 'all') {
            parts.push(`Type: ${entryTypeLabel(typeFilter)}`);
        }
        if (classFilter !== 'all') {
            parts.push(`Class ${classFilter}`);
        }
        if (searchFilter.trim()) {
            parts.push('Keyword filter active');
        }
        return `Current filters — ${parts.join(' • ')}`;
    }, [dateFilterLabel, typeFilter, classFilter, searchFilter]);

    const recordRows = useMemo(() => filteredAndSortedEntries.map(entry => {
        const member = membersMap.get(entry.memberID);

        return (
            <tr key={entry.id} className="bg-white border-b hover:bg-slate-50">
                <td className="px-6 py-4">{entry.date}</td>
                <td className="px-6 py-4 font-medium text-slate-900">{entry.memberName || '—'}</td>
                <td className="px-6 py-4 font-mono text-sm text-slate-600">{entry.memberID?.substring(0, 8) || '—'}</td>
                <td className="px-6 py-4 text-center">{member?.classNumber ? `Class ${member.classNumber}` : '—'}</td>
                <td className="px-6 py-4">{entryTypeLabel(entry.type)}</td>
                <td className="px-6 py-4">{formatCurrency(entry.amount, settings.currency)}</td>
                <td className="px-6 py-4 text-right">
                    <button
                        onClick={() => {
                            setSelectedEntry(entry);
                            setIsModalOpen(true);
                        }}
                        className="font-medium text-indigo-600 hover:underline"
                    >
                        Edit
                    </button>
                </td>
            </tr>
        );
    }), [filteredAndSortedEntries, membersMap, settings.currency, setIsModalOpen, setSelectedEntry]);

    // --- Handlers ---
    const handleLogin = (username: string, password: string) => {
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
        if (user) {
            setCurrentUser(user);
            setLoginError(null);
            // Navigate to appropriate landing page based on role
            setActiveTab(user.role === 'admin' || user.role === 'finance' ? 'home' : user.role === 'class-leader' ? 'attendance' : user.role === 'statistician' ? 'history' : 'records');
        } else {
            setLoginError('Invalid username or password.');
        }
    };

    const handleLogout = () => {
        if (typeof window !== 'undefined') {
            const id = presenceStateRef.current.id ?? getStoredPresenceId();
            if (id) {
                removePresenceRecord(id);
            }
            setStoredPresenceId(null);
            if (presenceIntervalRef.current !== null) {
                window.clearInterval(presenceIntervalRef.current);
                presenceIntervalRef.current = null;
            }
        }
        presenceStateRef.current.id = null;
        setActiveUserCount(null);
        setCurrentUser(null);
        setIsNavOpen(false);
        setCloud(prev => ({ ...prev, signedIn: false, accessToken: undefined, account: undefined, message: 'Ready for manual sign-in.' }));
    };

    const handleSaveEntry = (entry: Entry) => {
        const newEntries = [...entries];
        const index = newEntries.findIndex(e => e.id === entry.id);
        if (index > -1) {
            newEntries[index] = entry;
        } else {
            newEntries.push(entry);
        }
        setEntries(newEntries);
        setIsModalOpen(false);
    };

    const handleSaveAndNew = (entry: Entry) => {
        const newEntries = [...entries];
        // "Save and new" should only apply to new entries, so we just push.
        newEntries.push(entry);
        setEntries(newEntries);
        // Do not close the modal, allowing for the next entry.
    };
    
    const handleDeleteEntry = (id: string) => {
        setEntryToDeleteId(id);
        setIsConfirmModalOpen(true);
    };

    const confirmDeleteEntry = () => {
        if (entryToDeleteId) {
            setEntries(entries.filter(e => e.id !== entryToDeleteId));
            setIsModalOpen(false); // Close the entry modal as well
        }
        setIsConfirmModalOpen(false);
        setEntryToDeleteId(null);
    };

    const handleFinanceExport = (format: 'csv' | 'json') => {
        const dataset = filteredAndSortedEntries.map(entry => ({
            id: entry.id,
            date: entry.date,
            memberID: entry.memberID,
            memberName: entry.memberName,
            type: entry.type,
            fund: entry.fund ?? '',
            method: entry.method,
            amount: entry.amount,
            note: entry.note ?? '',
        }));

        if (dataset.length === 0) {
            setFinanceToast({ tone: 'info', message: 'No financial records match the current filters to export.' });
            return;
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        if (format === 'csv') {
            const csv = toCsv(dataset);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `gmct-financial-records-${timestamp}.csv`;
            link.click();
        } else {
            const json = JSON.stringify(dataset, null, 2);
            const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `gmct-financial-records-${timestamp}.json`;
            link.click();
        }

        setFinanceToast({
            tone: 'success',
            message: `Exported ${dataset.length} record${dataset.length === 1 ? '' : 's'} using current filters.`,
        });
    };

    const handleFinanceImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = typeof reader.result === 'string' ? reader.result : '';
                let rawRows: unknown[] = [];
                if (file.name.toLowerCase().endsWith('.csv')) {
                    rawRows = fromCsv(text);
                } else {
                    const parsed = JSON.parse(text) as unknown;
                    if (Array.isArray(parsed)) {
                        rawRows = parsed;
                    } else {
                        throw new Error('Invalid JSON shape');
                    }
                }

                const sanitizedEntries = rawRows.map(item => sanitizeEntry(item));
                if (sanitizedEntries.length === 0) {
                    setFinanceToast({ tone: 'info', message: 'No financial records were found in the selected file.' });
                    return;
                }

                let added = 0;
                let updated = 0;
                setEntries(prev => {
                    const map = new Map(prev.map(entry => [entry.id, entry]));
                    const next = [...prev];
                    sanitizedEntries.forEach(entry => {
                        if (map.has(entry.id)) {
                            const index = next.findIndex(item => item.id === entry.id);
                            if (index >= 0) {
                                next[index] = entry;
                                updated += 1;
                            }
                        } else {
                            next.push(entry);
                            map.set(entry.id, entry);
                            added += 1;
                        }
                    });
                    return next;
                });

                setFinanceToast({
                    tone: 'success',
                    message: `Import complete: ${sanitizedEntries.length} processed, ${added} added, ${updated} updated.`,
                });
            } catch (error) {
                console.error('Failed to import financial records', error);
                setFinanceToast({
                    tone: 'error',
                    message: 'Import failed. Ensure the file is a valid CSV or JSON export.',
                });
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleRecordImportClick = () => {
        setIsFinanceImportConfirmOpen(true);
    };

    const handleExport = useCallback((format: 'csv' | 'json') => {
        if (filteredAndSortedEntries.length === 0) {
            alert('No financial records match the current filters to export.');
            return;
        }

        const rows = filteredAndSortedEntries.map(entry => ({
            id: entry.id,
            date: entry.date,
            memberName: entry.memberName,
            memberId: entry.memberId ?? '',
            classNumber: entry.classNumber ?? '',
            type: entry.type,
            fund: entry.fund ?? '',
            method: entry.method ?? '',
            amount: entry.amount,
            note: entry.note ?? '',
            spId: entry.spId ?? '',
        }));

        const filename = `gmct-financial-records-${new Date().toISOString().slice(0, 10)}`;

        if (format === 'csv') {
            const csv = toCsv(rows);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}.csv`;
            link.click();
        } else {
            const json = JSON.stringify(rows, null, 2);
            const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}.json`;
            link.click();
        }
    }, [filteredAndSortedEntries]);

    const confirmFinanceImport = () => {
        setIsFinanceImportConfirmOpen(false);
        financeImportInputRef.current?.click();
    };

    const handleManualSync = useCallback(() => {
        if (isOffline) {
            setSyncMessage('Offline: changes will sync when connection returns.');
            return;
        }
        setShouldResync(prev => prev + 1);
        setSyncMessage('Manual sync requested. Checking SharePoint…');
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event(MANUAL_SYNC_EVENT));
        }
    }, [isOffline]);

    const handleBulkAddMembers = (importedMembers: Member[]) => {
        setMembers(prev => {
            const existingIds = new Set(prev.map(member => sanitizeString(member.id)));
            const next = [...prev];
            importedMembers.forEach(member => {
                const sanitizedMember = sanitizeMember(member);
                const normalizedId = sanitizeString(sanitizedMember.id);
                if (!existingIds.has(normalizedId)) {
                    next.push(sanitizedMember);
                    existingIds.add(normalizedId);
                }
            });
            return next;
        });
    };

    const handleResetAllData = () => {
        if (!window.confirm('This will permanently delete all locally stored data for this app. Continue?')) {
            return;
        }
        const storageKeys = ['gmct-entries', 'gmct-members', 'gmct-users', 'gmct-settings', 'gmct-attendance', 'gmct-weekly-history'];
        storageKeys.forEach(key => localStorage.removeItem(key));
        void clearAllTaskData().catch(error => console.error('Failed to clear task storage', error));
        setEntries([]);
        setMembers([]);
        setUsers(INITIAL_USERS);
        setSettings(INITIAL_SETTINGS);
        setAttendance([]);
        setWeeklyHistory([]);
        setCurrentUser(null);
        setCloud({ ready: false, signedIn: false, message: 'Local data cleared. Sign in again to continue.' });
    };
    
    const handleFullExport = () => {
        const data = { entries, members, users, settings, attendance, weeklyHistory };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `gmct-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
    };

    const handleSaveTotalClasses = (total: number) => {
        setSettings(prev => ({ ...prev, maxClasses: total }));
    };

    const handleFullImport = (file: File) => {
        if (!window.confirm('This will overwrite all current data. Are you sure you want to continue?')) return;

        const reader = new FileReader();
        reader.onload = event => {
            try {
                const raw = JSON.parse(event.target?.result as string);

                if (Object.prototype.hasOwnProperty.call(raw, 'entries')) {
                    setEntries(sanitizeEntriesCollection(raw.entries));
                }

                if (Object.prototype.hasOwnProperty.call(raw, 'members')) {
                    setMembers(sanitizeMembersCollection(raw.members));
                }

                if (Object.prototype.hasOwnProperty.call(raw, 'users')) {
                    setUsers(sanitizeUsersCollection(raw.users, INITIAL_USERS));
                }

                if (Object.prototype.hasOwnProperty.call(raw, 'settings')) {
                    setSettings(sanitizeSettings(raw.settings));
                }

                if (Object.prototype.hasOwnProperty.call(raw, 'attendance')) {
                    setAttendance(sanitizeAttendanceCollection(raw.attendance));
                }

                if (Object.prototype.hasOwnProperty.call(raw, 'weeklyHistory')) {
                    setWeeklyHistory(sanitizeWeeklyHistoryCollection(raw.weeklyHistory));
                }

                alert('Data imported successfully!');
            } catch (error) {
                console.error('Import error:', error);
                alert('Failed to read or parse the backup file.');
            }
        };
        reader.readAsText(file);
    };

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        // if sorting by the same key, toggle the direction
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key !== key && key === 'date') {
            // if switching to date column, default to descending
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };
    
    // --- UI Rendering ---

    if (!currentUser) {
        return <Login onLogin={handleLogin} error={loginError} />;
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'home': return currentUser.role === 'admin' || currentUser.role === 'finance' ? <AdminLandingPage onNavigate={setActiveTab} currentUser={currentUser} /> : <Dashboard entries={filteredAndSortedEntries} settings={settings} />;
            case 'records': {
                const isSharePointLive = recordsDataSource === 'sharepoint';
                const dataSourceText = isSharePointLive
                    ? 'Data source: SharePoint (live)'
                    : 'Data source: Local records (not synced)';
                const dataSourceTone = isSharePointLive
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-amber-200 bg-amber-50 text-amber-700';
                return (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Financial Records</h2>
                                <p className="text-sm text-slate-500">Manage contributions, secure exports, and quick imports from this view.</p>
                            </div>
                            <div className="flex flex-col items-stretch gap-4 sm:self-end min-w-[220px]">
                                <button
                                    type="button"
                                    onClick={() => { setSelectedEntry(null); setIsModalOpen(true); }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm"
                                >
                                    Add New Entry
                                </button>
                                <div className="flex flex-wrap gap-2 sm:justify-end pt-3 border-t border-indigo-100">
                                    <button
                                        type="button"
                                        onClick={() => handleExport('csv')}
                                        className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold py-2 px-4 rounded-lg hover:bg-white"
                                    >
                                        Export CSV
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleExport('json')}
                                        className="bg-slate-900 hover:bg-slate-950 text-white font-semibold py-2 px-4 rounded-lg"
                                    >
                                        Export JSON
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRecordImportClick}
                                        className="bg-white/80 border border-indigo-200 text-indigo-700 font-semibold py-2 px-4 rounded-lg hover:bg-white"
                                    >
                                        Import
                                    </button>
                                </div>
                            </div>
                        </div>
                        <input
                            ref={financeImportInputRef}
                            type="file"
                            accept=".csv,.json"
                            className="hidden"
                            onChange={handleFinanceImportFileChange}
                        />
                        <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${dataSourceTone}`} role="status">
                            <div>{dataSourceText}</div>
                            {!isSharePointLive && (
                                <p className="text-xs font-medium text-slate-500 mt-1">
                                    Updates will sync to SharePoint once a connection is restored.
                                </p>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-amber-50 to-orange-100/70 p-4">
                                <p className="text-sm uppercase tracking-wide text-amber-600 font-semibold">Entries Displayed</p>
                                <p className="text-3xl font-extrabold text-slate-800 mt-1">{filteredAndSortedEntries.length.toLocaleString()}</p>
                                <p className="text-xs text-slate-500 mt-2">Entries that match the current filters.</p>
                            </div>
                            <div className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-100/70 p-4">
                                <p className="text-sm uppercase tracking-wide text-emerald-600 font-semibold">Total Received</p>
                                <p className="text-3xl font-extrabold text-slate-800 mt-1">{formatCurrency(filteredTotalAmount, settings.currency)}</p>
                                <p className="text-xs text-slate-500 mt-2 leading-relaxed">Active filters: {filtersSummary}</p>
                            </div>
                        </div>

                        {/* Filter Controls */}
                        <div className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-sky-50 to-cyan-100/70 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                            <div className="lg:col-span-1">
                                <label htmlFor="searchFilter" className="block text-sm font-medium text-slate-700">Search Member</label>
                                <input type="text" id="searchFilter" placeholder="Name or ID..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm"/>
                            </div>
                            <div className="lg:col-span-1">
                                <label htmlFor="classFilter" className="block text-sm font-medium text-slate-700">Class</label>
                                <select id="classFilter" value={classFilter} onChange={e => setClassFilter(e.target.value)} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm">
                                    <option value="all">All Classes</option>
                                    {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => (<option key={num} value={num}>Class {num}</option>))}
                                </select>
                            </div>
                            <div className="lg:col-span-1">
                                <label htmlFor="typeFilter" className="block text-sm font-medium text-slate-700">Type</label>
                                <select id="typeFilter" value={typeFilter} onChange={e => setTypeFilter(e.target.value as EntryType | 'all')} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm">
                                    <option value="all">All Types</option>
                                    {ENTRY_TYPE_VALUES.map(type => (
                                        <option key={type} value={type}>{entryTypeLabel(type)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="startDateFilter" className="block text-sm font-medium text-slate-700">Start Date</label>
                                    <input type="date" id="startDateFilter" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm"/>
                                </div>
                                <div>
                                    <label htmlFor="endDateFilter" className="block text-sm font-medium text-slate-700">End Date</label>
                                    <input type="date" id="endDateFilter" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm"/>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl shadow-lg border border-white/60 bg-white/80 backdrop-blur overflow-x-auto max-h-[65vh] overflow-y-auto">
                           <table className="w-full text-left text-slate-500">
                                <thead className="text-base text-slate-700 uppercase bg-slate-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3"><button onClick={() => handleSort('date')} className="flex items-center gap-1 font-bold">Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</button></th>
                                        <th className="px-6 py-3"><button onClick={() => handleSort('memberName')} className="flex items-center gap-1 font-bold">Member {sortConfig.key === 'memberName' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</button></th>
                                        <th className="px-6 py-3 font-bold">Member ID</th>
                                        <th className="px-6 py-3"><button onClick={() => handleSort('classNumber')} className="flex items-center gap-1 font-bold">Class # {sortConfig.key === 'classNumber' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</button></th>
                                        <th className="px-6 py-3"><button onClick={() => handleSort('type')} className="flex items-center gap-1 font-bold">Type {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</button></th>
                                        <th className="px-6 py-3"><button onClick={() => handleSort('amount')} className="flex items-center gap-1 font-bold">Amount {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</button></th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>{recordRows}</tbody>
                           </table>
                        </div>
                        <div className="mt-4 rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 px-6 py-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm uppercase tracking-wide text-slate-600 font-semibold">Entries Displayed</p>
                                    <p className="text-2xl font-bold text-slate-900">{filteredAndSortedEntries.length.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm uppercase tracking-wide text-emerald-600 font-semibold">Total Received</p>
                                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(filteredTotalAmount, settings.currency)}</p>
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-slate-500 leading-relaxed">{filtersSummary}</p>
                        </div>
                    </div>
                );
            }
            case 'members': return <Members members={members} setMembers={setMembers} settings={settings} />;
            case 'insights': return <Insights entries={filteredAndSortedEntries} settings={settings} />;
            case 'history':
                return (
                    <WeeklyHistory
                        history={weeklyHistory}
                        setHistory={setWeeklyHistory}
                        canEdit={['admin', 'statistician'].includes(currentUser.role)}
                    />
                );
            case 'tasks':
                if (!['admin', 'finance'].includes(currentUser.role)) {
                    return <div className="p-6 text-slate-600">You do not have access to task management.</div>;
                }
                return (
                    <TasksTab
                        currentUser={currentUser}
                        users={users}
                        cloud={cloud}
                        isOffline={isOffline}
                    />
                );
            case 'users': return <UsersTab users={users} setUsers={setUsers} />;
            case 'settings':
                return (
                    <SettingsTab
                        settings={settings}
                        setSettings={setSettings}
                        cloud={cloud}
                        setCloud={setCloud}
                        onExport={handleFullExport}
                        onImport={handleFullImport}
                        onCloudSignInSuccess={handleCloudSignInSuccess}
                    />
                );
            case 'attendance': return <Attendance members={members} attendance={attendance} setAttendance={setAttendance} currentUser={currentUser} settings={settings} onAttendanceSaved={setLastAttendanceSavedAt} />;
            case 'admin-attendance': return <AdminAttendanceView members={members} attendance={attendance} settings={settings} currentUser={currentUser} />;
            case 'utilities':
                return (
                    <Utilities
                        entries={entries}
                        members={members}
                        settings={settings}
                        cloud={cloud}
                        onImportMembers={handleBulkAddMembers}
                        onResetData={handleResetAllData}
                        onSaveTotalClasses={handleSaveTotalClasses}
                    />
                );
            default: return <div>Select a tab</div>;
        }
    };

    type NavItem = {
        id: Tab;
        label: string;
        roles: UserRole[];
    };

    const navItems: NavItem[] = [
        { id: 'home', label: 'HOME', roles: ['admin', 'finance'] },
        { id: 'tasks', label: 'TASKS', roles: ['admin', 'finance'] },
        { id: 'records', label: 'FINANCIAL RECORDS', roles: ['admin', 'finance'] },
        { id: 'members', label: 'MEMBERS', roles: ['admin', 'finance', 'class-leader', 'statistician'] },
        { id: 'insights', label: 'INSIGHTS', roles: ['admin', 'finance'] },
        { id: 'attendance', label: 'MARK ATTENDANCE', roles: ['admin', 'class-leader'] },
        { id: 'admin-attendance', label: 'ATTENDANCE REPORT', roles: ['admin', 'finance'] },
        { id: 'history', label: 'WEEKLY HISTORY', roles: ['admin', 'statistician'] },
        { id: 'users', label: 'MANAGE USERS', roles: ['admin', 'finance'] },
        { id: 'utilities', label: 'UTILITIES', roles: ['admin'] },
        { id: 'settings', label: 'SETTINGS', roles: ['admin'] },
    ];

    const visibleNavItems = navItems.filter(item => item.roles.includes(currentUser.role));

    const renderNavButton = (item: NavItem) => (
        <button
            key={item.id}
            onClick={() => setActiveTab(item.id as Tab)}
            className={`w-full text-left font-semibold px-4 py-3 rounded-xl transition-colors tracking-wide uppercase ${
                activeTab === item.id
                    ? 'bg-white/25 text-white shadow-lg'
                    : 'text-indigo-100 hover:bg-white/15 hover:text-white'
            }`}
        >
            {item.label}
        </button>
    );

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-indigo-50 to-rose-50">
            <div className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
                <Header
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    currentDate={currentDate}
                    activeUserCount={activeUserCount}
                />
                <div className="mt-4">
                    <SyncStatus
                        isOffline={isOffline}
                        syncMessage={syncMessage}
                        lastSyncedAt={lastSyncedAt}
                        lastAttendanceSavedAt={lastAttendanceSavedAt}
                        activeSyncTasks={activeSyncTasks}
                        cloudReady={cloud.ready}
                        cloudSignedIn={cloud.signedIn}
                        onManualSync={handleManualSync}
                        manualSyncBusy={activeSyncTasks > 0}
                    />
                </div>
                <main className="mt-6 flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-18rem)] lg:overflow-hidden">
                    <aside className="hidden lg:block lg:w-72 flex-shrink-0">
                        <nav className="h-full rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 text-indigo-50 shadow-xl border border-indigo-400/40 p-5 space-y-2 overflow-y-auto">
                            {visibleNavItems.map(renderNavButton)}
                        </nav>
                    </aside>
                    <section className="flex-1 overflow-hidden">
                        <div className="h-full overflow-y-auto pr-1 sm:pr-2 lg:pr-4 pb-10">
                            {renderTabContent()}
                        </div>
                    </section>
                </main>
                {isModalOpen && <EntryModal entry={selectedEntry} members={members} settings={settings} onSave={handleSaveEntry} onSaveAndNew={handleSaveAndNew} onClose={() => setIsModalOpen(false)} onDelete={handleDeleteEntry} />}
                <ConfirmationModal
                    isOpen={isFinanceImportConfirmOpen}
                    onClose={() => setIsFinanceImportConfirmOpen(false)}
                    onConfirm={confirmFinanceImport}
                    title="Confirm Import"
                    message="Importing may overwrite or merge existing records. Do you want to continue?"
                    confirmLabel="Import"
                    cancelLabel="Cancel"
                    confirmTone="primary"
                />
                <ConfirmationModal
                    isOpen={isConfirmModalOpen}
                    onClose={() => {
                        setIsConfirmModalOpen(false);
                        setEntryToDeleteId(null);
                    }}
                    onConfirm={confirmDeleteEntry}
                    title="Confirm Deletion"
                    message="Are you sure you want to delete this financial entry? This action cannot be undone."
                />
            </div>
        </div>
    );
};

export default App;
