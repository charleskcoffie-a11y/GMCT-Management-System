import type { Task } from '../types';
import { sanitizeTask } from '../utils';

const DB_NAME = 'gmct-task-store';
const DB_VERSION = 1;
const STORE_TASKS = 'tasks';
const STORE_METADATA = 'metadata';
const STORE_DELETIONS = 'deletions';

export type QueuedTaskDeletion = {
    id: string;
    spId?: string;
    queuedAt: string;
};

async function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const factory: IDBFactory | undefined = typeof indexedDB !== 'undefined' ? indexedDB : undefined;
        if (!factory) {
            reject(new Error('IndexedDB is not available in this environment.'));
            return;
        }
        const request = factory.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_TASKS)) {
                db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_METADATA)) {
                db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(STORE_DELETIONS)) {
                db.createObjectStore(STORE_DELETIONS, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Failed to open task database.'));
    });
}

function withTransaction<T>(storeNames: string[], mode: IDBTransactionMode, handler: (tx: IDBTransaction) => void, db: IDBDatabase, resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) {
    try {
        const transaction = db.transaction(storeNames, mode);
        handler(transaction);
        transaction.oncomplete = () => {
            db.close();
        };
        transaction.onerror = () => {
            const error = transaction.error ?? new Error('Task storage transaction failed.');
            db.close();
            reject(error);
        };
    } catch (error) {
        db.close();
        reject(error);
    }
}

export async function getAllTasks(): Promise<Task[]> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        withTransaction<Task[]>([STORE_TASKS], 'readonly', transaction => {
            const store = transaction.objectStore(STORE_TASKS);
            const request = store.getAll();
            request.onsuccess = () => {
                const raw = Array.isArray(request.result) ? request.result : [];
                const tasks = raw.map(item => sanitizeTask(item)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
                resolve(tasks);
            };
            request.onerror = () => {
                reject(request.error ?? new Error('Unable to read tasks from storage.'));
            };
        }, db, resolve, reject);
    });
}

export async function saveTask(task: Task): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        withTransaction<void>([STORE_TASKS], 'readwrite', transaction => {
            const store = transaction.objectStore(STORE_TASKS);
            store.put(task);
            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
        }, db, resolve, reject);
    });
}

export async function deleteTask(id: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        withTransaction<void>([STORE_TASKS], 'readwrite', transaction => {
            const store = transaction.objectStore(STORE_TASKS);
            store.delete(id);
            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
        }, db, resolve, reject);
    });
}

export async function getDirtyTasks(): Promise<Task[]> {
    const tasks = await getAllTasks();
    return tasks.filter(task => task._sync.dirty);
}

export async function markTaskSynced(id: string, timestamp: string, spId?: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        withTransaction<void>([STORE_TASKS], 'readwrite', transaction => {
            const store = transaction.objectStore(STORE_TASKS);
            const request = store.get(id);
            request.onsuccess = () => {
                const existing = request.result as Task | undefined;
                if (!existing) {
                    resolve();
                    return;
                }
                const updated: Task = {
                    ...existing,
                    spId: spId ?? existing.spId,
                    _sync: {
                        dirty: false,
                        lastSyncedAt: timestamp,
                    },
                };
                store.put(updated);
            };
            request.onerror = () => {
                reject(request.error ?? new Error('Unable to update task sync state.'));
            };
            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
        }, db, resolve, reject);
    });
}

export async function setLastSyncedAt(timestamp?: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        withTransaction<void>([STORE_METADATA], 'readwrite', transaction => {
            const store = transaction.objectStore(STORE_METADATA);
            if (timestamp) {
                store.put({ key: 'lastSyncedAt', value: timestamp });
            } else {
                store.delete('lastSyncedAt');
            }
            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
        }, db, resolve, reject);
    });
}

export async function getLastSyncedAt(): Promise<string | undefined> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        withTransaction<string | undefined>([STORE_METADATA], 'readonly', transaction => {
            const store = transaction.objectStore(STORE_METADATA);
            const request = store.get('lastSyncedAt');
            request.onsuccess = () => {
                const record = request.result as { value?: string } | undefined;
                const value = record?.value;
                resolve(typeof value === 'string' ? value : undefined);
            };
            request.onerror = () => {
                reject(request.error ?? new Error('Unable to read sync metadata.'));
            };
        }, db, resolve, reject);
    });
}

export async function queueTaskDeletion(id: string, spId?: string): Promise<void> {
    const db = await openDatabase();
    const record: QueuedTaskDeletion = { id, spId, queuedAt: new Date().toISOString() };
    return new Promise((resolve, reject) => {
        withTransaction<void>([STORE_DELETIONS], 'readwrite', transaction => {
            const store = transaction.objectStore(STORE_DELETIONS);
            store.put(record);
            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
        }, db, resolve, reject);
    });
}

export async function getQueuedTaskDeletions(): Promise<QueuedTaskDeletion[]> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        withTransaction<QueuedTaskDeletion[]>([STORE_DELETIONS], 'readonly', transaction => {
            const store = transaction.objectStore(STORE_DELETIONS);
            const request = store.getAll();
            request.onsuccess = () => {
                const raw = Array.isArray(request.result) ? request.result : [];
                resolve(raw.map(item => ({
                    id: item.id,
                    spId: typeof item.spId === 'string' ? item.spId : undefined,
                    queuedAt: item.queuedAt,
                })));
            };
            request.onerror = () => {
                reject(request.error ?? new Error('Unable to load queued deletions.'));
            };
        }, db, resolve, reject);
    });
}

export async function clearQueuedTaskDeletion(id: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        withTransaction<void>([STORE_DELETIONS], 'readwrite', transaction => {
            const store = transaction.objectStore(STORE_DELETIONS);
            store.delete(id);
            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
        }, db, resolve, reject);
    });
}

export async function clearAllTaskData(): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        withTransaction<void>([STORE_TASKS, STORE_METADATA, STORE_DELETIONS], 'readwrite', transaction => {
            transaction.objectStore(STORE_TASKS).clear();
            transaction.objectStore(STORE_METADATA).clear();
            transaction.objectStore(STORE_DELETIONS).clear();
            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
        }, db, resolve, reject);
    });
}

export async function upsertManyTasks(tasks: Task[]): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        withTransaction<void>([STORE_TASKS], 'readwrite', transaction => {
            const store = transaction.objectStore(STORE_TASKS);
            for (const task of tasks) {
                store.put(task);
            }
            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
        }, db, resolve, reject);
    });
}
