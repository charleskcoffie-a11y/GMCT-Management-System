import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CloudState, Settings, Task, TaskPriority, TaskStatus, User } from '../types';
import { DEFAULT_SUPABASE_TASKS_TABLE, MANUAL_SYNC_EVENT } from '../constants';
import {
    clearQueuedTaskDeletion,
    deleteTask as deleteTaskFromStore,
    getAllTasks,
    getDirtyTasks,
    getLastSyncedAt as readLastSyncedAt,
    getQueuedTaskDeletions,
    markTaskSynced,
    queueTaskDeletion,
    saveTask,
    setLastSyncedAt as persistLastSyncedAt,
    upsertManyTasks,
} from '../services/tasksStorage';
import {
    deleteTaskFromSupabase,
    isSupabaseConfigured,
    loadTasksFromSupabase,
    upsertTaskToSupabase,
} from '../services/supabase';
import { fromCsv, generateId, sanitizeTask, toCsv } from '../utils';

const statusOptions: TaskStatus[] = ['Pending', 'In Progress', 'Completed'];
const priorityOptions: TaskPriority[] = ['Low', 'Medium', 'High'];

const TASK_CSV_HEADERS = [
    'Task ID',
    'Task Title',
    'Notes',
    'Assigned To',
    'Due Date',
    'Status',
    'Priority',
    'Created By',
    'Created At',
    'Updated At',
    'SP ID',
    'Last Synced At',
];

type ToastState = { message: string; tone: 'success' | 'error' | 'info' } | null;

type TaskFilters = {
    status: 'all' | TaskStatus;
    due: 'all' | 'today' | 'week' | 'overdue';
    assignee: 'all' | 'unassigned' | string;
    priority: 'all' | TaskPriority;
    sort: 'due-asc' | 'due-desc' | 'created-desc';
};

type TaskFormState = {
    title: string;
    notes: string;
    dueDate: string;
    assignedTo: string;
    priority: TaskPriority;
    status: TaskStatus;
};

type TasksTabProps = {
    currentUser: User;
    users: User[];
    cloud: CloudState;
    settings: Settings;
    isOffline: boolean;
};

const defaultFilters: TaskFilters = {
    status: 'all',
    due: 'all',
    assignee: 'all',
    priority: 'all',
    sort: 'due-asc',
};

const defaultFormState: TaskFormState = {
    title: '',
    notes: '',
    dueDate: '',
    assignedTo: '',
    priority: 'Medium',
    status: 'Pending',
};

function isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'Completed') {
        return false;
    }
    const today = new Date();
    const due = new Date(`${task.dueDate}T23:59:59`);
    return due.getTime() < today.getTime();
}

function formatDate(value?: string): string {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '—';
    }
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const TaskModal: React.FC<{
    visible: boolean;
    onClose: () => void;
    onSave: (form: TaskFormState) => Promise<void>;
    form: TaskFormState;
    setForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
    isEditing: boolean;
    canEdit: boolean;
    assignees: string[];
}> = ({ visible, onClose, onSave, form, setForm, isEditing, canEdit, assignees }) => {
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!visible) {
            setError(null);
            setIsSaving(false);
        }
    }, [visible]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canEdit || isSaving) return;
        const trimmedTitle = form.title.trim();
        if (!trimmedTitle) {
            setError('Title is required.');
            return;
        }
        if (trimmedTitle.length > 120) {
            setError('Title must be 120 characters or fewer.');
            return;
        }
        if (form.notes.length > 2000) {
            setError('Notes must be 2000 characters or fewer.');
            return;
        }
        setIsSaving(true);
        try {
            await onSave({ ...form, title: trimmedTitle });
        } catch (saveError) {
            console.error('Failed to save task', saveError);
            setError(saveError instanceof Error ? saveError.message : 'Unable to save task.');
            setIsSaving(false);
            return;
        }
        setIsSaving(false);
        onClose();
    };

    if (!visible) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-slate-800">{isEditing ? 'Edit Task' : 'Add Task'}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700" aria-label="Close">
                        ✕
                    </button>
                </div>
                {error && <p className="mb-3 text-sm text-rose-600" role="alert">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Title<span className="text-rose-500">*</span></label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
                            maxLength={120}
                            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Notes</label>
                        <textarea
                            value={form.notes}
                            onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                            maxLength={2000}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                        />
                        <p className="mt-1 text-xs text-slate-500">Optional. {2000 - form.notes.length} characters remaining.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">Due Date</span>
                            <input
                                type="date"
                                value={form.dueDate}
                                onChange={event => setForm(prev => ({ ...prev, dueDate: event.target.value }))}
                                className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                            />
                        </label>
                        <label className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">Assigned To</span>
                            <select
                                value={form.assignedTo}
                                onChange={event => setForm(prev => ({ ...prev, assignedTo: event.target.value }))}
                                className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                            >
                                <option value="">Unassigned</option>
                                {assignees.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <label className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">Priority</span>
                            <select
                                value={form.priority}
                                onChange={event => setForm(prev => ({ ...prev, priority: event.target.value as TaskPriority }))}
                                className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                            >
                                {priorityOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">Status</span>
                            <select
                                value={form.status}
                                onChange={event => setForm(prev => ({ ...prev, status: event.target.value as TaskStatus }))}
                                className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                            >
                                {statusOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                        <div className="flex items-end">
                            <button
                                type="submit"
                                disabled={isSaving || !canEdit}
                                className="w-full rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSaving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TaskDetailDrawer: React.FC<{
    task: Task | null;
    onClose: () => void;
    onEdit: (task: Task) => void;
    onUpdateStatus: (task: Task, status: TaskStatus) => void;
    onDelete: (task: Task) => void;
    canEdit: boolean;
}> = ({ task, onClose, onEdit, onUpdateStatus, onDelete, canEdit }) => {
    if (!task) {
        return null;
    }
    const overdue = isOverdue(task);
    return (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30 backdrop-blur-sm">
            <div className="h-full w-full max-w-lg bg-white shadow-2xl p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Task ${task.title}`}>
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Task Detail</p>
                        <h2 className="mt-1 text-2xl font-semibold text-slate-800">{task.title}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700" aria-label="Close task detail">✕</button>
                </div>
                <div className={`mt-4 rounded-2xl border ${overdue ? 'border-amber-300 bg-amber-50/80' : 'border-slate-200 bg-slate-50/80'} p-4`}> 
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <span><strong>Status:</strong> {task.status}</span>
                        <span><strong>Priority:</strong> {task.priority}</span>
                        <span><strong>Assigned:</strong> {task.assignedTo || 'Unassigned'}</span>
                        <span><strong>Due:</strong> {formatDate(task.dueDate)}</span>
                    </div>
                </div>
                {task.notes && (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                        <h3 className="text-sm font-semibold text-slate-700">Notes</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.notes}</p>
                    </div>
                )}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-500">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="font-semibold text-slate-600">Created</p>
                        <p className="mt-1">{formatDate(task.createdAt)}</p>
                        <p className="text-xs text-slate-400">By {task.createdBy || 'Unknown'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="font-semibold text-slate-600">Last Updated</p>
                        <p className="mt-1">{formatDate(task.updatedAt)}</p>
                        {task._sync.lastSyncedAt && <p className="text-xs text-slate-400">Synced {formatDate(task._sync.lastSyncedAt)}</p>}
                    </div>
                </div>
                {canEdit && (
                    <div className="mt-6 flex flex-wrap gap-3">
                        {task.status !== 'Completed' && (
                            <button
                                type="button"
                                onClick={() => onUpdateStatus(task, 'Completed')}
                                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                            >
                                Mark Completed
                            </button>
                        )}
                        {task.status !== 'In Progress' && (
                            <button
                                type="button"
                                onClick={() => onUpdateStatus(task, 'In Progress')}
                                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                            >
                                Mark In Progress
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onEdit(task)}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            Edit Task
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm('Delete this task? This will remove it locally and queue a cloud deletion.')) {
                                    onDelete(task);
                                }
                            }}
                            className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                        >
                            Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const TaskList: React.FC<{ tasks: Task[]; onOpenTask: (task: Task) => void }> = ({ tasks, onOpenTask }) => {
    if (tasks.length === 0) {
        return <p className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-slate-500">No tasks match your filters yet. Create a task to get started.</p>;
    }
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {tasks.map(task => {
                const overdue = isOverdue(task);
                return (
                    <button
                        key={task.id}
                        type="button"
                        onClick={() => onOpenTask(task)}
                        className={`w-full rounded-3xl border px-5 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                            overdue ? 'border-amber-300 bg-amber-50/80' : 'border-white/60 bg-white/80'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-400">{task.priority} Priority</p>
                                <h3 className="mt-1 text-lg font-semibold text-slate-800">{task.title}</h3>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                task.status === 'Completed'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : task.status === 'In Progress'
                                        ? 'bg-indigo-100 text-indigo-700'
                                        : 'bg-slate-100 text-slate-600'
                            }`}>
                                {task.status}
                            </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                            <span><strong>Due:</strong> {formatDate(task.dueDate)}</span>
                            <span><strong>Assigned:</strong> {task.assignedTo || 'Unassigned'}</span>
                            <span><strong>Updated:</strong> {formatDate(task.updatedAt)}</span>
                        </div>
                        {task._sync.dirty && <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-600">Pending sync</p>}
                    </button>
                );
            })}
        </div>
    );
};

const TasksTab: React.FC<TasksTabProps> = ({ currentUser, users, cloud, settings, isOffline }) => {
    const canEdit = ['admin', 'finance'].includes(currentUser.role);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [filters, setFilters] = useState<TaskFilters>(defaultFilters);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [formState, setFormState] = useState<TaskFormState>(defaultFormState);
    const [toast, setToast] = useState<ToastState>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
    const taskFileInputRef = useRef<HTMLInputElement | null>(null);
    const supabaseConfigured = isSupabaseConfigured();
    const tasksTableName = settings.supabaseTasksTable || DEFAULT_SUPABASE_TASKS_TABLE;

    const refreshTasks = useCallback(async () => {
        const allTasks = await getAllTasks();
        setTasks(allTasks);
    }, []);

    const handleExportTasks = useCallback(() => {
        if (tasks.length === 0) {
            setToast({ message: 'No tasks available to export yet.', tone: 'info' });
            return;
        }
        const rows = tasks.map(task => {
            const row: Record<string, string> = {};
            row['Task ID'] = task.id;
            row['Task Title'] = task.title;
            row['Notes'] = task.notes ?? '';
            row['Assigned To'] = task.assignedTo ?? '';
            row['Due Date'] = task.dueDate ?? '';
            row['Status'] = task.status;
            row['Priority'] = task.priority;
            row['Created By'] = task.createdBy;
            row['Created At'] = task.createdAt;
            row['Updated At'] = task.updatedAt;
            row['SP ID'] = task.spId ?? '';
            row['Last Synced At'] = task._sync.lastSyncedAt ?? '';
            return row;
        });
        const csv = toCsv(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        setToast({ message: `Exported ${rows.length} task${rows.length === 1 ? '' : 's'}.`, tone: 'success' });
    }, [tasks]);

    const handleImportTasks = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const rows = fromCsv(text);
            if (!rows || rows.length === 0) {
                setToast({ message: 'The selected CSV file did not contain any tasks to import.', tone: 'error' });
                return;
            }
            const firstRow = rows[0] as Record<string, string>;
            const missing = TASK_CSV_HEADERS.filter(header => !(header in firstRow));
            if (missing.length > 0) {
                setToast({ message: `CSV is missing columns: ${missing.join(', ')}.`, tone: 'error' });
                return;
            }
            const existingIds = new Set(tasks.map(task => task.id));
            const imported: Task[] = [];
            let skipped = 0;
            for (const raw of rows) {
                const row = raw as Record<string, string>;
                const title = (row['Task Title'] ?? '').trim();
                const status = (row['Status'] ?? '').trim();
                if (!title || !status) {
                    skipped += 1;
                    continue;
                }
                const shaped = {
                    id: row['Task ID'],
                    title,
                    notes: row['Notes'],
                    assignedTo: row['Assigned To'],
                    dueDate: row['Due Date'],
                    status,
                    priority: row['Priority'],
                    createdBy: row['Created By'] ?? currentUser.username,
                    createdAt: row['Created At'],
                    updatedAt: row['Updated At'],
                    spId: row['SP ID'],
                    _sync: { dirty: true, lastSyncedAt: row['Last Synced At'] },
                };
                const sanitized = sanitizeTask(shaped);
                sanitized.spId = shaped.spId && shaped.spId.trim() ? shaped.spId.trim() : sanitized.spId;
                sanitized._sync = {
                    dirty: true,
                    lastSyncedAt: sanitized._sync.lastSyncedAt,
                };
                imported.push(sanitized);
            }
            if (imported.length === 0) {
                setToast({
                    message: skipped > 0
                        ? 'No tasks were imported because each row was incomplete or invalid.'
                        : 'No tasks were imported. The CSV did not contain any valid rows.',
                    tone: 'error',
                });
                return;
            }
            let added = 0;
            let updated = 0;
            imported.forEach(task => {
                if (existingIds.has(task.id)) {
                    updated += 1;
                } else {
                    added += 1;
                }
            });
            await upsertManyTasks(imported);
            await refreshTasks();
            setToast({
                message: `Imported ${imported.length} tasks (${added} added, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}).`,
                tone: 'success',
            });
        } catch (error) {
            console.error('Failed to import tasks CSV', error);
            setToast({ message: 'Unable to import tasks. Ensure the CSV matches the exported format.', tone: 'error' });
        } finally {
            event.target.value = '';
        }
    }, [currentUser.username, refreshTasks, tasks]);

    useEffect(() => {
        let mounted = true;
        const initialise = async () => {
            const [allTasks, syncedAt] = await Promise.all([getAllTasks(), readLastSyncedAt()]);
            if (!mounted) return;
            setTasks(allTasks);
            setLastSyncedAt(syncedAt ?? null);
        };
        initialise().catch(error => console.error('Failed to load tasks', error));
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timeout = window.setTimeout(() => setToast(null), 4000);
        return () => window.clearTimeout(timeout);
    }, [toast]);

    const attemptHydrateFromCloud = useCallback(async () => {
        if (!cloud.signedIn || !supabaseConfigured || isOffline) {
            return;
        }
        try {
            const remoteTasks = await loadTasksFromSupabase(tasksTableName);
            if (remoteTasks.length === 0) {
                return;
            }
            const sanitizedRemote = remoteTasks.map(task => {
                const sanitized = sanitizeTask(task);
                return { ...sanitized, _sync: { dirty: false, lastSyncedAt: sanitized._sync.lastSyncedAt ?? sanitized.updatedAt } };
            });
            await upsertManyTasks(sanitizedRemote);
            await refreshTasks();
        } catch (error) {
            console.error('Failed to load tasks from cloud', error);
            setToast({ message: 'Unable to refresh tasks from cloud.', tone: 'error' });
        }
    }, [cloud.signedIn, isOffline, refreshTasks, supabaseConfigured, tasksTableName]);

    useEffect(() => {
        void attemptHydrateFromCloud();
    }, [attemptHydrateFromCloud]);

    const syncDirtyTasks = useCallback(async (reason: 'auto' | 'manual' = 'auto') => {
        if (isSyncing) {
            if (reason === 'manual') {
                setToast({ message: 'Sync already in progress.', tone: 'info' });
            }
            return;
        }
        if (isOffline) {
            if (reason === 'manual') {
                setToast({ message: 'Offline – changes will sync when you reconnect.', tone: 'info' });
            }
            return;
        }
        if (!cloud.signedIn || !supabaseConfigured) {
            if (reason === 'manual') {
                setToast({ message: 'Configure Supabase sync before syncing tasks.', tone: 'info' });
            }
            return;
        }
        setIsSyncing(true);
        try {
            const [dirtyTasks, queuedDeletions] = await Promise.all([getDirtyTasks(), getQueuedTaskDeletions()]);
            if (dirtyTasks.length === 0 && queuedDeletions.length === 0) {
                if (reason === 'manual') {
                    setToast({ message: 'Tasks are already up to date.', tone: 'success' });
                }
                const synced = await readLastSyncedAt();
                setLastSyncedAt(synced ?? null);
                return;
            }
            const syncTimestamp = new Date().toISOString();
            for (const task of dirtyTasks) {
                const remoteId = await upsertTaskToSupabase(task, tasksTableName);
                await markTaskSynced(task.id, syncTimestamp, remoteId);
            }
            for (const deletion of queuedDeletions) {
                await deleteTaskFromSupabase({ id: deletion.id, spId: deletion.spId }, tasksTableName);
                await clearQueuedTaskDeletion(deletion.id);
            }
            await persistLastSyncedAt(syncTimestamp);
            setLastSyncedAt(syncTimestamp);
            setToast({ message: 'Tasks synced with cloud.', tone: 'success' });
            await refreshTasks();
        } catch (error) {
            console.error('Task sync failed', error);
            setToast({ message: error instanceof Error ? error.message : 'Task sync failed.', tone: 'error' });
        } finally {
            setIsSyncing(false);
        }
    }, [cloud.signedIn, isOffline, isSyncing, refreshTasks, supabaseConfigured, tasksTableName]);

    useEffect(() => {
        if (isOffline) return;
        const dirty = tasks.some(task => task._sync.dirty);
        if (dirty) {
            void syncDirtyTasks('auto');
        }
    }, [tasks, isOffline, syncDirtyTasks]);

    useEffect(() => {
        if (isOffline) return;
        const handleOnline = () => {
            void syncDirtyTasks('auto');
        };
        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, [isOffline, syncDirtyTasks]);

    useEffect(() => {
        const handleManualSync = () => {
            void attemptHydrateFromCloud();
            void syncDirtyTasks('manual');
        };
        window.addEventListener(MANUAL_SYNC_EVENT as any, handleManualSync as EventListener);
        return () => {
            window.removeEventListener(MANUAL_SYNC_EVENT as any, handleManualSync as EventListener);
        };
    }, [attemptHydrateFromCloud, syncDirtyTasks]);

    const handleModalClose = () => {
        setIsModalVisible(false);
        setEditingTask(null);
        setFormState(defaultFormState);
    };

    const handleOpenCreateModal = () => {
        setEditingTask(null);
        setFormState(defaultFormState);
        setIsModalVisible(true);
    };

    const handleOpenEditModal = (task: Task) => {
        setEditingTask(task);
        setFormState({
            title: task.title,
            notes: task.notes ?? '',
            dueDate: task.dueDate ?? '',
            assignedTo: task.assignedTo ?? '',
            priority: task.priority,
            status: task.status,
        });
        setIsModalVisible(true);
        setActiveTask(null);
    };

    const handleSaveTask = async (form: TaskFormState) => {
        if (!canEdit) return;
        const now = new Date().toISOString();
        const trimmedNotes = form.notes.trim();
        if (editingTask) {
            const updated: Task = {
                ...editingTask,
                createdBy: editingTask.createdBy || currentUser.username,
                title: form.title,
                notes: trimmedNotes ? trimmedNotes : undefined,
                dueDate: form.dueDate || undefined,
                assignedTo: form.assignedTo || undefined,
                priority: form.priority,
                status: form.status,
                updatedAt: now,
                _sync: { dirty: true, lastSyncedAt: editingTask._sync.lastSyncedAt },
            };
            await saveTask(updated);
            setToast({ message: 'Task updated.', tone: 'success' });
        } else {
            const newTask: Task = {
                id: generateId('task'),
                title: form.title,
                notes: trimmedNotes ? trimmedNotes : undefined,
                createdBy: currentUser.username,
                assignedTo: form.assignedTo || undefined,
                dueDate: form.dueDate || undefined,
                priority: form.priority,
                status: form.status,
                createdAt: now,
                updatedAt: now,
                _sync: { dirty: true },
            };
            await saveTask(newTask);
            setToast({ message: 'Task created.', tone: 'success' });
        }
        await refreshTasks();
        if (!isOffline) {
            void syncDirtyTasks('auto');
        }
    };

    const handleUpdateStatus = async (task: Task, status: TaskStatus) => {
        if (!canEdit) return;
        const now = new Date().toISOString();
        const updated: Task = {
            ...task,
            status,
            updatedAt: now,
            _sync: { dirty: true, lastSyncedAt: task._sync.lastSyncedAt },
        };
        await saveTask(updated);
        setActiveTask(updated);
        setToast({ message: `Task marked ${status}.`, tone: 'success' });
        await refreshTasks();
        if (!isOffline) {
            void syncDirtyTasks('auto');
        }
    };

    const handleDeleteTask = async (task: Task) => {
        if (!canEdit) return;
        await queueTaskDeletion(task.id, task.spId);
        await deleteTaskFromStore(task.id);
        setActiveTask(null);
        setToast({ message: 'Task deleted.', tone: 'success' });
        await refreshTasks();
        if (!isOffline) {
            void syncDirtyTasks('auto');
        }
    };

    const availableAssignees = useMemo(() => {
        const names = new Set<string>();
        names.add('Admin');
        names.add('Finance');
        for (const user of users) {
            names.add(user.username);
        }
        for (const task of tasks) {
            if (task.assignedTo) {
                names.add(task.assignedTo);
            }
        }
        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [tasks, users]);

    const filteredTasks = useMemo(() => {
        const today = new Date();
        const startOfWeek = new Date(today);
        const dayOfWeek = startOfWeek.getDay();
        startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        const matches = tasks.filter(task => {
            if (filters.status !== 'all' && task.status !== filters.status) {
                return false;
            }
            if (filters.priority !== 'all' && task.priority !== filters.priority) {
                return false;
            }
            if (filters.assignee === 'unassigned' && task.assignedTo) {
                return false;
            }
            if (filters.assignee !== 'all' && filters.assignee !== 'unassigned' && task.assignedTo !== filters.assignee) {
                return false;
            }
            if (filters.due !== 'all') {
                if (!task.dueDate) {
                    return false;
                }
                const dueDate = new Date(`${task.dueDate}T23:59:59`);
                switch (filters.due) {
                    case 'today':
                        if (dueDate.toDateString() !== today.toDateString()) {
                            return false;
                        }
                        break;
                    case 'week':
                        if (dueDate < startOfWeek || dueDate > endOfWeek) {
                            return false;
                        }
                        break;
                    case 'overdue':
                        if (!(dueDate < today && task.status !== 'Completed')) {
                            return false;
                        }
                        break;
                    default:
                        break;
                }
            }
            return true;
        });
        const sorted = [...matches];
        sorted.sort((a, b) => {
            switch (filters.sort) {
                case 'due-desc': {
                    const dueA = a.dueDate ? new Date(`${a.dueDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
                    const dueB = b.dueDate ? new Date(`${b.dueDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
                    if (!a.dueDate && !b.dueDate) return b.updatedAt.localeCompare(a.updatedAt);
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    if (dueA === dueB) return b.updatedAt.localeCompare(a.updatedAt);
                    return dueB - dueA;
                }
                case 'created-desc':
                    return b.createdAt.localeCompare(a.createdAt);
                case 'due-asc':
                default: {
                    const dueA = a.dueDate ? new Date(`${a.dueDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
                    const dueB = b.dueDate ? new Date(`${b.dueDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
                    if (!a.dueDate && !b.dueDate) return b.updatedAt.localeCompare(a.updatedAt);
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    if (dueA === dueB) return b.updatedAt.localeCompare(a.updatedAt);
                    return dueA - dueB;
                }
            }
        });
        return sorted;
    }, [filters, tasks]);

    const dueFilterOptions: Array<{ value: TaskFilters['due']; label: string }> = [
        { value: 'all', label: 'All Due Dates' },
        { value: 'today', label: 'Today' },
        { value: 'week', label: 'This Week' },
        { value: 'overdue', label: 'Overdue' },
    ];

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Task Management</h1>
                    <p className="text-sm text-slate-500">Track finance and admin follow-ups with offline-first syncing.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => syncDirtyTasks('manual')}
                        disabled={isSyncing}
                        className="rounded-xl border border-indigo-200 bg-white/80 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSyncing ? 'Syncing…' : 'Sync Now'}
                    </button>
                    {canEdit && (
                        <>
                            <button
                                type="button"
                                onClick={handleExportTasks}
                                className="rounded-xl border border-indigo-200 bg-white/80 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-white"
                            >
                                Export CSV
                            </button>
                            <button
                                type="button"
                                onClick={() => taskFileInputRef.current?.click()}
                                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-950"
                            >
                                Import CSV
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenCreateModal}
                                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                            >
                                Add Task
                            </button>
                        </>
                    )}
                </div>
            </header>
            <input ref={taskFileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportTasks} />

            <section className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-lg">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        Status
                        <select
                            value={filters.status}
                            onChange={event => setFilters(prev => ({ ...prev, status: event.target.value as TaskFilters['status'] }))}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        >
                            <option value="all">All Statuses</option>
                            {statusOptions.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        Due
                        <select
                            value={filters.due}
                            onChange={event => setFilters(prev => ({ ...prev, due: event.target.value as TaskFilters['due'] }))}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        >
                            {dueFilterOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        Assignee
                        <select
                            value={filters.assignee}
                            onChange={event => setFilters(prev => ({ ...prev, assignee: event.target.value }))}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        >
                            <option value="all">All People</option>
                            <option value="unassigned">Unassigned</option>
                            {availableAssignees.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                            Priority
                            <select
                                value={filters.priority}
                                onChange={event => setFilters(prev => ({ ...prev, priority: event.target.value as TaskFilters['priority'] }))}
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            >
                                <option value="all">All Priorities</option>
                                {priorityOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                            Sort
                            <select
                                value={filters.sort}
                                onChange={event => setFilters(prev => ({ ...prev, sort: event.target.value as TaskFilters['sort'] }))}
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            >
                                <option value="due-asc">Due Date ↑</option>
                                <option value="due-desc">Due Date ↓</option>
                                <option value="created-desc">Newest Created</option>
                            </select>
                        </label>
                    </div>
                </div>
            </section>

            <TaskList tasks={filteredTasks} onOpenTask={task => setActiveTask(task)} />

            <footer className="flex flex-col gap-2 rounded-3xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm text-indigo-800">
                {isOffline ? (
                    <p className="font-semibold">Offline – changes will sync when online.</p>
                ) : (
                    <p className="font-semibold">Connected – syncing automatically when changes are detected.</p>
                )}
                <p className="text-xs text-indigo-700/80">Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Not synced yet'}</p>
            </footer>

            {toast && (
                <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg ${
                    toast.tone === 'success'
                        ? 'bg-emerald-600 text-white'
                        : toast.tone === 'error'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-900 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            <TaskModal
                visible={isModalVisible}
                onClose={handleModalClose}
                onSave={handleSaveTask}
                form={formState}
                setForm={setFormState}
                isEditing={Boolean(editingTask)}
                canEdit={canEdit}
                assignees={availableAssignees}
            />

            <TaskDetailDrawer
                task={activeTask}
                onClose={() => setActiveTask(null)}
                onEdit={handleOpenEditModal}
                onUpdateStatus={handleUpdateStatus}
                onDelete={handleDeleteTask}
                canEdit={canEdit}
            />
        </div>
    );
};

export default TasksTab;
