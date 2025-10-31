import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Task, TaskPriority, TaskStatus, User } from '../types';
import { generateId, sanitizeTask } from '../utils';
import {
    isIndexedDbAvailable,
    loadLastSyncedAt,
    loadTasksFromStorage,
    persistLastSyncedAt,
    persistTasksToStorage,
} from '../services/tasksStorage';

export type TaskDraft = {
    title: string;
    notes?: string;
    dueDate?: string;
    assignedTo?: string;
    status: TaskStatus;
    priority: TaskPriority;
};

export type TaskPatch = Partial<Pick<Task, 'title' | 'notes' | 'dueDate' | 'assignedTo' | 'status' | 'priority'>>;

export interface UseTasksResult {
    loading: boolean;
    tasks: Task[];
    isOffline: boolean;
    lastSyncedAt: string | null;
    isSyncing: boolean;
    syncMessage: string | null;
    syncError: string | null;
    storageError: string | null;
    createTask: (draft: TaskDraft, currentUser: User) => Promise<void>;
    updateTask: (id: string, updates: TaskPatch) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    markTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
    syncTasks: () => Promise<void>;
}

const SYNC_DELAY_MS = 250;

async function simulateCloudSync(_tasks: Task[]): Promise<void> {
    // Placeholder for real API integration. We still await a tick to mimic latency.
    await new Promise<void>(resolve => {
        setTimeout(resolve, SYNC_DELAY_MS);
    });
}

export function useTasks(): UseTasksResult {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
    const [lastSyncedAt, setLastSyncedAtState] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [storageError, setStorageError] = useState<string | null>(null);
    const hasAttemptedInitialSyncRef = useRef(false);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const storedTasks = await loadTasksFromStorage();
                if (!active) return;
                setTasks(storedTasks.map(task => sanitizeTask(task)));
                const storedLastSync = await loadLastSyncedAt();
                if (!active) return;
                setLastSyncedAtState(storedLastSync ?? null);
            } catch (error) {
                console.error('useTasks: failed to hydrate tasks', error);
                if (!active) return;
                setStorageError('Unable to read tasks from local storage. New changes will still be stored in memory.');
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!hasAttemptedInitialSyncRef.current && !loading) {
            hasAttemptedInitialSyncRef.current = true;
            if (!isIndexedDbAvailable()) {
                setStorageError('IndexedDB is unavailable; using an in-memory task store.');
            }
        }
    }, [loading]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const updateOnlineStatus = () => {
            setIsOffline(!navigator.onLine);
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);

    const commitTasks = useCallback(async (updater: (prev: Task[]) => Task[]) => {
        let nextTasks: Task[] = [];
        setTasks(prev => {
            nextTasks = updater(prev);
            return nextTasks;
        });

        try {
            await persistTasksToStorage(nextTasks);
            setStorageError(null);
        } catch (error) {
            console.error('useTasks: failed to persist tasks', error);
            setStorageError('Unable to persist tasks to local storage. Changes remain in memory only.');
        }

        return nextTasks;
    }, []);

    const createTask = useCallback(async (draft: TaskDraft, currentUser: User) => {
        const now = new Date().toISOString();
        const task: Task = sanitizeTask({
            id: generateId('task'),
            title: draft.title,
            notes: draft.notes,
            createdBy: currentUser.username,
            assignedTo: draft.assignedTo,
            dueDate: draft.dueDate,
            status: draft.status,
            priority: draft.priority,
            createdAt: now,
            updatedAt: now,
            _sync: { dirty: true },
        });

        await commitTasks(prev => [...prev, task]);
    }, [commitTasks]);

    const updateTask = useCallback(async (id: string, updates: TaskPatch) => {
        const now = new Date().toISOString();
        await commitTasks(prev => prev.map(task => {
            if (task.id !== id) {
                return task;
            }
            return sanitizeTask({
                ...task,
                ...updates,
                updatedAt: now,
                _sync: { ...task._sync, dirty: true },
            });
        }));
    }, [commitTasks]);

    const deleteTask = useCallback(async (id: string) => {
        await commitTasks(prev => prev.filter(task => task.id !== id));
    }, [commitTasks]);

    const markTaskStatus = useCallback(async (id: string, status: TaskStatus) => {
        await updateTask(id, { status });
    }, [updateTask]);

    const syncTasks = useCallback(async () => {
        if (isOffline) {
            setSyncError('Cannot sync while offline. Changes will sync automatically when back online.');
            return;
        }
        const dirtyTasks = tasks.filter(task => task._sync.dirty);
        if (dirtyTasks.length === 0) {
            setSyncMessage('All tasks are already synced.');
            setSyncError(null);
            return;
        }

        setIsSyncing(true);
        setSyncMessage(null);
        setSyncError(null);
        try {
            await simulateCloudSync(dirtyTasks);
            const syncedAt = new Date().toISOString();
            const dirtyIds = new Set(dirtyTasks.map(task => task.id));
            await commitTasks(prev => prev.map(task => dirtyIds.has(task.id)
                ? { ...task, _sync: { dirty: false, lastSyncedAt: syncedAt } }
                : task,
            ));
            await persistLastSyncedAt(syncedAt);
            setLastSyncedAtState(syncedAt);
            setSyncMessage(`Synced ${dirtyTasks.length} task${dirtyTasks.length === 1 ? '' : 's'} just now.`);
        } catch (error) {
            console.error('useTasks: sync failed', error);
            setSyncError('Unable to sync tasks to the cloud right now. Changes remain saved locally.');
        } finally {
            setIsSyncing(false);
        }
    }, [commitTasks, isOffline, tasks]);

    const previouslyOffline = useRef(isOffline);
    useEffect(() => {
        if (previouslyOffline.current && !isOffline && !loading) {
            previouslyOffline.current = isOffline;
            if (tasks.some(task => task._sync.dirty)) {
                void syncTasks();
            }
            return;
        }
        previouslyOffline.current = isOffline;
    }, [isOffline, loading, syncTasks, tasks]);

    useEffect(() => {
        if (!syncMessage) return;
        const timeout = setTimeout(() => setSyncMessage(null), 4000);
        return () => clearTimeout(timeout);
    }, [syncMessage]);

    return useMemo(() => ({
        loading,
        tasks,
        isOffline,
        lastSyncedAt,
        isSyncing,
        syncMessage,
        syncError,
        storageError,
        createTask,
        updateTask,
        deleteTask,
        markTaskStatus,
        syncTasks,
    }), [
        createTask,
        deleteTask,
        isOffline,
        isSyncing,
        lastSyncedAt,
        loading,
        markTaskStatus,
        storageError,
        syncError,
        syncMessage,
        syncTasks,
        tasks,
        updateTask,
    ]);
}
