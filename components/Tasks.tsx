import React, { useEffect, useMemo, useState } from 'react';
import type { Task, TaskPriority, TaskStatus, User } from '../types';
import type { TaskDraft, TaskPatch } from '../hooks/useTasks';

const statusColors: Record<TaskStatus, string> = {
    Pending: 'bg-amber-100 text-amber-800 border-amber-200',
    'In Progress': 'bg-sky-100 text-sky-800 border-sky-200',
    Completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const priorityColors: Record<TaskPriority, string> = {
    Low: 'bg-slate-100 text-slate-700 border-slate-200',
    Medium: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    High: 'bg-rose-100 text-rose-800 border-rose-200',
};

type TasksTabProps = {
    currentUser: User;
    users: User[];
    tasks: Task[];
    loading: boolean;
    isOffline: boolean;
    isSyncing: boolean;
    lastSyncedAt: string | null;
    syncMessage: string | null;
    syncError: string | null;
    storageError: string | null;
    onCreateTask: (draft: TaskDraft) => Promise<void>;
    onUpdateTask: (id: string, updates: TaskPatch) => Promise<void>;
    onDeleteTask: (id: string) => Promise<void>;
    onSync: () => Promise<void>;
};

type DueFilter = 'all' | 'today' | 'this-week' | 'overdue';
type StatusFilter = 'all' | TaskStatus;
type PriorityFilter = 'all' | TaskPriority;

type TaskFormModalProps = {
    isOpen: boolean;
    title: string;
    initialValues: TaskDraft;
    assigneeOptions: string[];
    onSubmit: (values: TaskDraft) => Promise<void>;
    onCancel: () => void;
};

type TaskDetailDrawerProps = {
    task: Task;
    open: boolean;
    canEdit: boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => Promise<void>;
    onStatusChange: (status: TaskStatus) => Promise<void>;
};

function parseIsoDay(value?: string): Date | null {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(part => Number.parseInt(part, 10));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return null;
    }
    const result = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(result.getTime()) ? null : result;
}

function formatDate(value?: string): string {
    if (!value) return 'No due date';
    const parsed = parseIsoDay(value);
    if (!parsed) return 'Invalid date';
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isTaskOverdue(task: Task, reference: Date): boolean {
    if (task.status === 'Completed') return false;
    const dueDate = parseIsoDay(task.dueDate);
    if (!dueDate) return false;
    const ref = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
    return dueDate < ref;
}

function getAssigneeLabel(value?: string): string {
    if (!value) return 'Unassigned';
    return value;
}

function TaskBadge({ label, className }: { label: string; className: string }) {
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}>
            {label}
        </span>
    );
}

const TaskFormModal: React.FC<TaskFormModalProps> = ({ isOpen, title, initialValues, assigneeOptions, onSubmit, onCancel }) => {
    const [formValues, setFormValues] = useState<TaskDraft>(initialValues);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormValues(initialValues);
            setError(null);
            setSubmitting(false);
        }
    }, [initialValues, isOpen]);

    if (!isOpen) return null;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = event.target;
        setFormValues(prev => ({
            ...prev,
            [name]: name === 'notes' ? value : value.trim().length === 0 ? '' : value,
        }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!formValues.title.trim()) {
            setError('Title is required.');
            return;
        }
        if (formValues.title.trim().length > 120) {
            setError('Title must be 120 characters or fewer.');
            return;
        }
        if (formValues.notes && formValues.notes.length > 2000) {
            setError('Notes must be 2000 characters or fewer.');
            return;
        }
        if (formValues.dueDate) {
            const parsed = parseIsoDay(formValues.dueDate);
            if (!parsed) {
                setError('Please provide a valid due date (YYYY-MM-DD).');
                return;
            }
        }

        try {
            setSubmitting(true);
            await onSubmit({
                ...formValues,
                title: formValues.title.trim(),
                notes: formValues.notes?.trim() || undefined,
                dueDate: formValues.dueDate?.trim() || undefined,
                assignedTo: formValues.assignedTo?.trim() || undefined,
            });
        } catch (submitError) {
            console.error('TaskFormModal: failed to submit task', submitError);
            setError('Unable to save the task right now. Please try again.');
            setSubmitting(false);
            return;
        }

        setSubmitting(false);
        onCancel();
    };

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
                <form onSubmit={handleSubmit} className="space-y-6 p-6 sm:p-8">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
                            <p className="text-sm text-slate-500">Capture key details to keep everyone aligned.</p>
                        </div>
                        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
                            <span className="sr-only">Close</span>
                            ×
                        </button>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <label className="flex flex-col text-sm font-semibold text-slate-700 sm:col-span-2">
                            Title
                            <input
                                name="title"
                                value={formValues.title}
                                onChange={handleChange}
                                maxLength={120}
                                required
                                className="mt-2 rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </label>

                        <label className="flex flex-col text-sm font-semibold text-slate-700 sm:col-span-2">
                            Notes
                            <textarea
                                name="notes"
                                value={formValues.notes ?? ''}
                                onChange={handleChange}
                                maxLength={2000}
                                rows={4}
                                placeholder="Additional context, steps, or references"
                                className="mt-2 rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </label>

                        <label className="flex flex-col text-sm font-semibold text-slate-700">
                            Due date
                            <input
                                type="date"
                                name="dueDate"
                                value={formValues.dueDate ?? ''}
                                onChange={handleChange}
                                className="mt-2 rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </label>

                        <label className="flex flex-col text-sm font-semibold text-slate-700">
                            Assigned to
                            <select
                                name="assignedTo"
                                value={formValues.assignedTo ?? ''}
                                onChange={handleChange}
                                className="mt-2 rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">Unassigned</option>
                                {assigneeOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col text-sm font-semibold text-slate-700">
                            Priority
                            <select
                                name="priority"
                                value={formValues.priority}
                                onChange={handleChange}
                                className="mt-2 rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </label>

                        <label className="flex flex-col text-sm font-semibold text-slate-700">
                            Status
                            <select
                                name="status"
                                value={formValues.status}
                                onChange={handleChange}
                                className="mt-2 rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="Pending">Pending</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                            </select>
                        </label>
                    </div>

                    {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600">{error}</p>}

                    <div className="flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 sm:w-auto"
                        >
                            {isSubmitting ? 'Saving…' : 'Save Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({ task, open, canEdit, onClose, onEdit, onDelete, onStatusChange }) => {
    const [isWorking, setWorking] = useState(false);
    if (!open) return null;

    const handleDelete = async () => {
        if (!window.confirm('Delete this task? This action cannot be undone.')) {
            return;
        }
        try {
            setWorking(true);
            await onDelete();
            onClose();
        } finally {
            setWorking(false);
        }
    };

    const handleQuickStatus = async (status: TaskStatus) => {
        if (status === task.status) return;
        try {
            setWorking(true);
            await onStatusChange(status);
        } finally {
            setWorking(false);
        }
    };

    const syncedLabel = task._sync.lastSyncedAt
        ? new Date(task._sync.lastSyncedAt).toLocaleString()
        : 'Not yet synced';

    return (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 backdrop-blur-sm">
            <aside className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{task.title}</h2>
                        <p className="text-sm text-slate-500">Created by {task.createdBy} • Updated {new Date(task.updatedAt).toLocaleString()}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <span className="sr-only">Close</span>
                        ×
                    </button>
                </div>

                <div className="space-y-6 px-6 py-6">
                    <div className="flex flex-wrap gap-2">
                        <TaskBadge label={task.status} className={statusColors[task.status]} />
                        <TaskBadge label={`${task.priority} priority`} className={priorityColors[task.priority]} />
                        {task._sync.dirty && <TaskBadge label="Pending sync" className="bg-yellow-100 text-yellow-800 border-yellow-200" />}
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <p><span className="font-semibold text-slate-800">Due date:</span> {formatDate(task.dueDate)}</p>
                        <p><span className="font-semibold text-slate-800">Assigned to:</span> {getAssigneeLabel(task.assignedTo)}</p>
                        <p><span className="font-semibold text-slate-800">Created:</span> {new Date(task.createdAt).toLocaleString()}</p>
                        <p><span className="font-semibold text-slate-800">Last synced:</span> {syncedLabel}</p>
                    </div>

                    {task.notes && (
                        <section>
                            <h3 className="text-sm font-semibold text-slate-800">Notes</h3>
                            <p className="mt-2 whitespace-pre-line rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600">
                                {task.notes}
                            </p>
                        </section>
                    )}

                    {canEdit && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-800">Quick actions</h3>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        onClick={() => void handleQuickStatus('Pending')}
                                        disabled={isWorking || task.status === 'Pending'}
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Mark Pending
                                    </button>
                                    <button
                                        onClick={() => void handleQuickStatus('In Progress')}
                                        disabled={isWorking || task.status === 'In Progress'}
                                        className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                                    >
                                        Mark In Progress
                                    </button>
                                    <button
                                        onClick={() => void handleQuickStatus('Completed')}
                                        disabled={isWorking || task.status === 'Completed'}
                                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                    >
                                        Mark Completed
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={onEdit}
                                    disabled={isWorking}
                                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                                >
                                    Edit task
                                </button>
                                <button
                                    onClick={() => void handleDelete()}
                                    disabled={isWorking}
                                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                                >
                                    Delete task
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
};

const TasksTab: React.FC<TasksTabProps> = ({
    currentUser,
    users,
    tasks,
    loading,
    isOffline,
    isSyncing,
    lastSyncedAt,
    syncMessage,
    syncError,
    storageError,
    onCreateTask,
    onUpdateTask,
    onDeleteTask,
    onSync,
}) => {
    const canEdit = currentUser.role === 'admin' || currentUser.role === 'finance';
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [dueFilter, setDueFilter] = useState<DueFilter>('all');
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
    const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<'due-asc' | 'due-desc' | 'created-desc'>('due-asc');
    const [isModalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('Add Task');
    const [modalInitialValues, setModalInitialValues] = useState<TaskDraft>({
        title: '',
        notes: '',
        dueDate: undefined,
        assignedTo: undefined,
        status: 'Pending',
        priority: 'Medium',
    });
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);

    const activeTask = useMemo(() => tasks.find(task => task.id === activeTaskId) ?? null, [tasks, activeTaskId]);

    const assigneeOptions = useMemo(() => {
        const values = new Set<string>();
        users.forEach(user => values.add(user.username));
        values.add('Admin');
        values.add('Finance');
        tasks.forEach(task => {
            if (task.assignedTo) {
                values.add(task.assignedTo);
            }
        });
        return Array.from(values).sort((a, b) => a.localeCompare(b));
    }, [tasks, users]);

    const todayKey = new Date().toISOString().slice(0, 10);
    const overdueReference = parseIsoDay(todayKey) ?? new Date();

    const filteredTasks = useMemo(() => {
        const referenceDate = parseIsoDay(todayKey) ?? new Date();
        const startOfToday = new Date(referenceDate);
        const endOfWeek = new Date(startOfToday);
        endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6);

        const matchesDueFilter = (task: Task) => {
            if (dueFilter === 'all') return true;
            const dueDate = parseIsoDay(task.dueDate);
            if (!dueDate) return dueFilter === 'overdue' ? false : false;
            if (dueFilter === 'today') {
                return dueDate.getTime() === startOfToday.getTime();
            }
            if (dueFilter === 'this-week') {
                return dueDate >= startOfToday && dueDate <= endOfWeek;
            }
            if (dueFilter === 'overdue') {
                return task.status !== 'Completed' && dueDate < startOfToday;
            }
            return true;
        };

        const matchesStatus = (task: Task) => statusFilter === 'all' || task.status === statusFilter;
        const matchesPriority = (task: Task) => priorityFilter === 'all' || task.priority === priorityFilter;
        const matchesAssignee = (task: Task) => assigneeFilter === 'all' || task.assignedTo === assigneeFilter;

        const sorted = [...tasks].sort((a, b) => {
            if (sortOrder === 'created-desc') {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            const dateA = parseIsoDay(a.dueDate);
            const dateB = parseIsoDay(b.dueDate);
            const order = sortOrder === 'due-asc' ? 1 : -1;
            if (dateA && dateB) {
                return (dateA.getTime() - dateB.getTime()) * order;
            }
            if (!dateA && dateB) {
                return 1;
            }
            if (dateA && !dateB) {
                return -1;
            }
            return 0;
        });

        return sorted.filter(task => matchesStatus(task) && matchesPriority(task) && matchesAssignee(task) && matchesDueFilter(task));
    }, [assigneeFilter, dueFilter, priorityFilter, sortOrder, statusFilter, tasks, todayKey]);

    const openCreateModal = () => {
        setModalTitle('Add Task');
        setModalInitialValues({
            title: '',
            notes: '',
            dueDate: undefined,
            assignedTo: assigneeOptions.includes(currentUser.username) ? currentUser.username : undefined,
            status: 'Pending',
            priority: 'Medium',
        });
        setModalOpen(true);
    };

    const openEditModal = (task: Task) => {
        setModalTitle('Edit Task');
        setModalInitialValues({
            title: task.title,
            notes: task.notes,
            dueDate: task.dueDate,
            assignedTo: task.assignedTo,
            status: task.status,
            priority: task.priority,
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
    };

    const handleCreate = async (draft: TaskDraft) => {
        await onCreateTask(draft);
        setFeedback('Task created successfully.');
    };

    const handleUpdate = async (id: string, updates: TaskPatch) => {
        await onUpdateTask(id, updates);
        setFeedback('Task updated.');
    };

    const handleDelete = async (id: string) => {
        await onDeleteTask(id);
        setFeedback('Task deleted.');
    };

    useEffect(() => {
        if (!feedback) return;
        const timer = window.setTimeout(() => setFeedback(null), 4000);
        return () => window.clearTimeout(timer);
    }, [feedback]);

    const offlineBanner = isOffline ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Offline – changes will sync when online.
        </div>
    ) : null;

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 p-6 text-indigo-50 shadow-xl sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Task Management</h1>
                    <p className="mt-1 text-indigo-100/80">Coordinate finance and admin follow-ups with offline-first syncing.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => void onSync()}
                        disabled={isSyncing}
                        className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur hover:bg-white/20 disabled:opacity-60"
                    >
                        {isSyncing ? 'Syncing…' : 'Sync now'}
                    </button>
                    {canEdit && (
                        <button
                            onClick={openCreateModal}
                            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50"
                        >
                            Add Task
                        </button>
                    )}
                </div>
            </header>

            <div className="space-y-3">
                {offlineBanner}
                {storageError && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{storageError}</p>}
                {syncError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{syncError}</p>}
                {(syncMessage || feedback) && (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                        {feedback ?? syncMessage}
                    </p>
                )}
                {lastSyncedAt && (
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Last synced: {new Date(lastSyncedAt).toLocaleString()}</p>
                )}
            </div>

            <section className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-lg">
                <h2 className="text-lg font-semibold text-slate-800">Filters</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                        <select
                            value={statusFilter}
                            onChange={event => setStatusFilter(event.target.value as StatusFilter)}
                            className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="all">All</option>
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </label>

                    <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Due
                        <select
                            value={dueFilter}
                            onChange={event => setDueFilter(event.target.value as DueFilter)}
                            className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="all">All</option>
                            <option value="today">Today</option>
                            <option value="this-week">This week</option>
                            <option value="overdue">Overdue</option>
                        </select>
                    </label>

                    <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Priority
                        <select
                            value={priorityFilter}
                            onChange={event => setPriorityFilter(event.target.value as PriorityFilter)}
                            className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="all">All</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                    </label>

                    <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Assignee
                        <select
                            value={assigneeFilter}
                            onChange={event => setAssigneeFilter(event.target.value)}
                            className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="all">All</option>
                            {assigneeOptions.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-500 lg:col-span-4">
                        Sort
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button
                                onClick={() => setSortOrder('due-asc')}
                                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${sortOrder === 'due-asc' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                            >
                                Due date ↑
                            </button>
                            <button
                                onClick={() => setSortOrder('due-desc')}
                                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${sortOrder === 'due-desc' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                            >
                                Due date ↓
                            </button>
                            <button
                                onClick={() => setSortOrder('created-desc')}
                                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${sortOrder === 'created-desc' ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                            >
                                Newest first
                            </button>
                        </div>
                    </label>
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-800">Tasks</h2>
                {loading ? (
                    <div className="rounded-3xl border border-white/60 bg-white/70 p-6 text-center text-slate-500 shadow-lg">Loading tasks…</div>
                ) : filteredTasks.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-10 text-center text-slate-500 shadow-inner">
                        No tasks found for the selected filters.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredTasks.map(task => {
                            const overdue = isTaskOverdue(task, overdueReference);
                            return (
                                <button
                                    key={task.id}
                                    onClick={() => setActiveTaskId(task.id)}
                                    className={`flex h-full flex-col rounded-2xl border px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                                        overdue ? 'border-rose-200 bg-rose-50/60' : 'border-white/70 bg-white/80'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
                                        {task._sync.dirty && <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" aria-label="Pending sync" />}
                                    </div>
                                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Due {formatDate(task.dueDate)}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <TaskBadge label={task.status} className={statusColors[task.status]} />
                                        <TaskBadge label={task.priority} className={priorityColors[task.priority]} />
                                        <TaskBadge label={getAssigneeLabel(task.assignedTo)} className="bg-slate-100 text-slate-700 border-slate-200" />
                                    </div>
                                    {task.notes && (
                                        <p className="mt-3 line-clamp-3 text-sm text-slate-600">{task.notes}</p>
                                    )}
                                    <p className="mt-4 text-xs text-slate-400">Updated {new Date(task.updatedAt).toLocaleString()}</p>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <TaskFormModal
                isOpen={isModalOpen}
                title={modalTitle}
                initialValues={modalInitialValues}
                assigneeOptions={assigneeOptions}
                onSubmit={async draft => {
                    if (modalTitle === 'Add Task') {
                        await handleCreate(draft);
                    } else if (activeTask) {
                        await handleUpdate(activeTask.id, draft);
                    }
                }}
                onCancel={closeModal}
            />

            {activeTask && (
                <TaskDetailDrawer
                    task={activeTask}
                    open={Boolean(activeTask)}
                    canEdit={canEdit}
                    onClose={() => setActiveTaskId(null)}
                    onEdit={() => {
                        openEditModal(activeTask);
                    }}
                    onDelete={() => handleDelete(activeTask.id)}
                    onStatusChange={status => handleUpdate(activeTask.id, { status })}
                />
            )}
        </div>
    );
};

export default TasksTab;
