import { sanitizeTask, sanitizeTasksCollection } from '../utils';
import type { Task } from '../types';

const DB_NAME = 'gmct-task-state';
const STORE_NAME = 'state';
const TASKS_KEY = 'tasks';
const LAST_SYNC_KEY = 'lastSyncedAt';
const FALLBACK_STORAGE_KEY = 'gmct.tasks.state';

const memoryStore = new Map<string, unknown>();

function hasWindow(): boolean {
    return typeof window !== 'undefined';
}

function hasIndexedDb(): boolean {
    return typeof indexedDB !== 'undefined';
}

function withLocalStorage<T>(callback: (storage: Storage) => T): T | undefined {
    if (!hasWindow()) {
        return undefined;
    }
    try {
        return callback(window.localStorage);
    } catch (error) {
        console.warn('tasksStorage: localStorage operation failed.', error);
        return undefined;
    }
}

async function openDatabase(): Promise<IDBDatabase> {
    if (!hasIndexedDb()) {
        throw new Error('IndexedDB is not available in this environment.');
    }

    return await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onerror = () => {
            reject(request.error ?? new Error('Unknown IndexedDB error.'));
        };
        request.onsuccess = () => {
            resolve(request.result);
        };
    });
}

async function readValue<T>(key: string): Promise<T | undefined> {
    if (!hasIndexedDb()) {
        const fallback = memoryStore.get(key);
        if (fallback !== undefined) {
            return fallback as T;
        }
        const stored = withLocalStorage(storage => storage.getItem(`${FALLBACK_STORAGE_KEY}.${key}`));
        if (stored) {
            try {
                return JSON.parse(stored) as T;
            } catch (error) {
                console.warn('tasksStorage: Failed to parse localStorage value', error);
            }
        }
        return undefined;
    }

    const db = await openDatabase();
    try {
        return await new Promise<T | undefined>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onerror = () => reject(request.error ?? new Error('IndexedDB get failed.'));
            request.onsuccess = () => resolve(request.result as T | undefined);
        });
    } finally {
        db.close();
    }
}

async function writeValue<T>(key: string, value: T): Promise<void> {
    if (!hasIndexedDb()) {
        if (value === undefined) {
            memoryStore.delete(key);
            withLocalStorage(storage => {
                storage.removeItem(`${FALLBACK_STORAGE_KEY}.${key}`);
            });
            return;
        }
        memoryStore.set(key, value as unknown);
        withLocalStorage(storage => {
            storage.setItem(`${FALLBACK_STORAGE_KEY}.${key}`, JSON.stringify(value));
        });
        return;
    }

    const db = await openDatabase();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = value === undefined ? store.delete(key) : store.put(value as unknown, key);
            request.onerror = () => reject(request.error ?? new Error('IndexedDB put failed.'));
            request.onsuccess = () => resolve();
        });
    } finally {
        db.close();
    }
}

export async function loadTasksFromStorage(): Promise<Task[]> {
    try {
        const stored = await readValue<unknown>(TASKS_KEY);
        if (!stored) {
            return [];
        }
        if (Array.isArray(stored)) {
            return sanitizeTasksCollection(stored);
        }
        if (typeof stored === 'object') {
            return sanitizeTasksCollection([stored]);
        }
        return [];
    } catch (error) {
        console.error('tasksStorage: unable to load tasks from storage', error);
        return [];
    }
}

export async function persistTasksToStorage(tasks: Task[]): Promise<void> {
    try {
        const sanitized = tasks.map(task => sanitizeTask(task));
        await writeValue(TASKS_KEY, sanitized);
    } catch (error) {
        console.error('tasksStorage: unable to persist tasks', error);
        throw error;
    }
}

export async function loadLastSyncedAt(): Promise<string | undefined> {
    try {
        const stored = await readValue<string>(LAST_SYNC_KEY);
        if (stored && !Number.isNaN(Date.parse(stored))) {
            return new Date(stored).toISOString();
        }
        return undefined;
    } catch (error) {
        console.warn('tasksStorage: unable to read lastSyncedAt', error);
        return undefined;
    }
}

export async function persistLastSyncedAt(value: string | undefined): Promise<void> {
    try {
        if (!value) {
            await writeValue(LAST_SYNC_KEY, undefined);
            return;
        }
        await writeValue(LAST_SYNC_KEY, new Date(value).toISOString());
    } catch (error) {
        console.warn('tasksStorage: unable to persist lastSyncedAt', error);
        throw error;
    }
}

export function isIndexedDbAvailable(): boolean {
    return hasIndexedDb();
}
