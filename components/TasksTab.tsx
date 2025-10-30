import React, { useMemo, useState } from 'react';
import type { Task, TaskPriority, TaskStatus, User } from '../types';
import { sanitizeTaskPriority, sanitizeTaskStatus } from '../utils';

type TasksTabProps = {
    tasks: Task[];
    currentUser: User;
    onCreate: (payload: {
        title: string;
        notes?: string;
        dueDate?: string;
        assignedTo?: string;
        status: TaskStatus;
        priority: TaskPriority;
    }) => void;
    onUpdate: (id: string, updates: {
        title?: string;
        notes?: string | null;
        dueDate?: string | null;
        assignedTo?: string | null;
        status?: TaskStatus;
        priority?: TaskPriority;
    }) => void;
    onDelete: (id: string) => void;
    isOffline: boolean;
    lastSyncedAt: number | null;
};

type TaskModalProps = {
    visible: boolean;
    initialTask: Task | null;
    assigneeOptions: string[];
    onCancel: () => void;
    onSave: (values: {
        title: string;
        notes?: string;
        dueDate?: string;
        assignedTo?: string;
        status: TaskStatus;
        priority: TaskPriority;
    }) => void;
};

type DetailDrawerProps = {
    task: Task | null;
    canEdit: boolean;
    onClose: () => void;
    onEdit: (task: Task) => void;
    onUpdateStatus: (taskId: string, status: TaskStatus) => void;
    onDelete: (taskId: string) => void;
};

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
];

const priorityOptions: Array<{ value: TaskPriority; label: string }> = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
];

const dueFilters = [
    { value: 'all', label: 'All Due Dates' },
    { value: 'today', label: 'Due Today' },
    { value: 'week', label: 'Due This Week' },
    { value: 'overdue', label: 'Overdue' },
] as const;

type DueFilterValue = typeof dueFilters[number]['value'];

type SortOption = 'due-asc' | 'due-desc' | 'created-desc';

const sortOptions: Array<{ value: SortOption; label: string }> = [
    { value: 'due-asc', label: 'Due Date (Soonest)' },
    { value: 'due-desc', label: 'Due Date (Latest)' },
    { value: 'created-desc', label: 'Recently Created' },
];

const formatDate = (input?: string) => {
    if (!input) return 'No due date';
    const date = new Date(`${input}T00:00:00`);
    if (Number.isNaN(date.getTime())) return 'No due date';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};

const formatDateTime = (input?: string) => {
    if (!input) return '—';
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
};

const statusTone = (status: TaskStatus) => {
    switch (status) {
        case 'completed':
            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'in-progress':
            return 'bg-sky-100 text-sky-700 border-sky-200';
        default:
            return 'bg-amber-100 text-amber-700 border-amber-200';
    }
};

const priorityTone = (priority: TaskPriority) => {
    switch (priority) {
        case 'high':
            return 'text-rose-600';
        case 'low':
            return 'text-slate-500';
        default:
            return 'text-slate-700';
    }
};

const parseDueDate = (task: Task): Date | null => {
    if (!task.dueDate) return null;
    const parsed = new Date(`${task.dueDate}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isOverdue = (task: Task, today: Date) => {
    const dueDate = parseDueDate(task);
    if (!dueDate) return false;
    if (task.status === 'completed') return false;
    return dueDate < today;
};

const TaskModal: React.FC<TaskModalProps> = ({ visible, initialTask, assigneeOptions, onCancel, onSave }) => {
    const [title, setTitle] = useState(initialTask?.title ?? '');
    const [notes, setNotes] = useState(initialTask?.notes ?? '');
    const [dueDate, setDueDate] = useState(initialTask?.dueDate ?? '');
    const [assignedTo, setAssignedTo] = useState(initialTask?.assignedTo ?? '');
    const [status, setStatus] = useState<TaskStatus>(initialTask?.status ?? 'pending');
    const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority ?? 'medium');
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        setTitle(initialTask?.title ?? '');
        setNotes(initialTask?.notes ?? '');
        setDueDate(initialTask?.dueDate ?? '');
        setAssignedTo(initialTask?.assignedTo ?? '');
        setStatus(initialTask?.status ?? 'pending');
        setPriority(initialTask?.priority ?? 'medium');
        setError(null);
    }, [initialTask, visible]);

    if (!visible) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setError('Title is required.');
            return;
        }
        if (trimmedTitle.length > 120) {
            setError('Title must be 120 characters or less.');
            return;
        }
        if (notes.length > 2000) {
            setError('Notes must be 2000 characters or less.');
            return;
        }

        const trimmedNotes = notes.trim();
        onSave({
            title: trimmedTitle,
            notes: trimmedNotes ? trimmedNotes : undefined,
            dueDate: dueDate || undefined,
            assignedTo: assignedTo.trim() ? assignedTo.trim() : undefined,
            status: sanitizeTaskStatus(status),
            priority: sanitizeTaskPriority(priority),
        });
    };

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur">
            <div className="w-full max-w-2xl rounded-3xl bg-white/90 shadow-2xl border border-indigo-100">
                <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-800">{initialTask ? 'Edit Task' : 'Add Task'}</h2>
                    <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">Close</button>
                </header>
                <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
                    <div className="grid grid-cols-1 gap-4">
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Title</span>
                            <input
                                value={title}
                                onChange={event => setTitle(event.target.value)}
                                maxLength={120}
                                className="rounded-xl border border-slate-300 px-3 py-2"
                                placeholder="Task title"
                                required
                            />
                        </label>
                        <label className="flex flex-col gap-2">
                            <span className="text-sm font-semibold text-slate-600">Notes</span>
                            <textarea
                                value={notes}
                                onChange={event => setNotes(event.target.value)}
                                maxLength={2000}
                                rows={4}
                                className="rounded-xl border border-slate-300 px-3 py-2"
                                placeholder="Additional context (optional)"
                            />
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Due Date</span>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={event => setDueDate(event.target.value)}
                                    className="rounded-xl border border-slate-300 px-3 py-2"
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Assigned To</span>
                                <select
                                    value={assignedTo}
                                    onChange={event => setAssignedTo(event.target.value)}
                                    className="rounded-xl border border-slate-300 px-3 py-2"
                                >
                                    <option value="">Unassigned</option>
                                    {assigneeOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Priority</span>
                                <select
                                    value={priority}
                                    onChange={event => setPriority(event.target.value as TaskPriority)}
                                    className="rounded-xl border border-slate-300 px-3 py-2"
                                >
                                    {priorityOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-slate-600">Status</span>
                                <select
                                    value={status}
                                    onChange={event => setStatus(event.target.value as TaskStatus)}
                                    className="rounded-xl border border-slate-300 px-3 py-2"
                                >
                                    {statusOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                    {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold shadow-sm hover:bg-indigo-700">Save Task</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TaskDetailDrawer: React.FC<DetailDrawerProps> = ({ task, canEdit, onClose, onEdit, onUpdateStatus, onDelete }) => {
    if (!task) return null;

    const dueDateLabel = formatDate(task.dueDate);
    const isDirty = task._sync.dirty;
    const syncLabel = isDirty
        ? 'Pending sync'
        : task._sync.lastSyncedAt
            ? `Synced ${formatDateTime(task._sync.lastSyncedAt)}`
            : 'Synced';

    return (
        <div className="fixed inset-0 z-30 flex justify-end bg-slate-900/40 backdrop-blur-sm">
            <div className="w-full max-w-md h-full bg-white/95 shadow-2xl border-l border-slate-200 flex flex-col">
                <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase text-slate-500 tracking-wide">Task Detail</p>
                        <h3 className="text-lg font-semibold text-slate-800">{task.title}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">Close</button>
                </header>
                <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(task.status)}`}>
                        Status: {statusOptions.find(option => option.value === task.status)?.label ?? task.status}
                    </div>
                    <div className="space-y-3 text-sm">
                        <div>
                            <p className="text-slate-500 uppercase text-xs font-semibold">Assigned To</p>
                            <p className="text-slate-800 font-medium">{task.assignedTo || 'Unassigned'}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 uppercase text-xs font-semibold">Due Date</p>
                            <p className="text-slate-800 font-medium">{dueDateLabel}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 uppercase text-xs font-semibold">Priority</p>
                            <p className={`font-semibold ${priorityTone(task.priority)}`}>{priorityOptions.find(option => option.value === task.priority)?.label ?? task.priority}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 uppercase text-xs font-semibold">Notes</p>
                            <p className="text-slate-700 whitespace-pre-wrap">{task.notes || '—'}</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-xs text-slate-500">
                            <p>Created: <span className="font-semibold text-slate-700">{formatDateTime(task.createdAt)}</span></p>
                            <p>Last Updated: <span className="font-semibold text-slate-700">{formatDateTime(task.updatedAt)}</span></p>
                            <p>Sync: <span className={`font-semibold ${isDirty ? 'text-amber-600' : 'text-emerald-600'}`}>{syncLabel}</span></p>
                        </div>
                    </div>
                </div>
                {canEdit && (
                    <footer className="px-5 py-4 border-t border-slate-200 space-y-3">
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => onUpdateStatus(task.id, 'completed')}
                                className="flex-1 min-w-[120px] rounded-xl bg-emerald-600 text-white px-3 py-2 text-sm font-semibold hover:bg-emerald-700"
                            >
                                Mark Completed
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdateStatus(task.id, 'in-progress')}
                                className="flex-1 min-w-[120px] rounded-xl bg-sky-600 text-white px-3 py-2 text-sm font-semibold hover:bg-sky-700"
                            >
                                Mark In Progress
                            </button>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <button type="button" onClick={() => onEdit(task)} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                Edit Task
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm('Delete this task? This cannot be undone.')) {
                                        onDelete(task.id);
                                        onClose();
                                    }
                                }}
                                className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                            >
                                Delete
                            </button>
                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
};

const TasksTab: React.FC<TasksTabProps> = ({ tasks, currentUser, onCreate, onUpdate, onDelete, isOffline, lastSyncedAt }) => {
    const canEdit = currentUser.role === 'admin' || currentUser.role === 'finance';

    const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
    const [dueFilter, setDueFilter] = useState<DueFilterValue>('all');
    const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'unassigned' | string>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
    const [sortOrder, setSortOrder] = useState<SortOption>('due-asc');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

    const editingTask = useMemo(() => tasks.find(task => task.id === editingTaskId) ?? null, [tasks, editingTaskId]);
    const detailTask = useMemo(() => tasks.find(task => task.id === detailTaskId) ?? null, [tasks, detailTaskId]);

    const assigneeOptions = useMemo(() => {
        const unique = new Set<string>();
        ['Admin', 'Finance'].forEach(label => unique.add(label));
        tasks.forEach(task => {
            if (task.assignedTo) {
                unique.add(task.assignedTo);
            }
        });
        return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
    }, [tasks]);

    const today = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now;
    }, []);

    const weekBounds = useMemo(() => {
        const start = new Date(today);
        const day = start.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        start.setDate(start.getDate() + diff);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }, [today]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            if (statusFilter !== 'all' && task.status !== statusFilter) {
                return false;
            }
            if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
                return false;
            }
            if (assigneeFilter === 'unassigned' && task.assignedTo) {
                return false;
            }
            if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned') {
                if ((task.assignedTo ?? '').toLowerCase() !== assigneeFilter.toLowerCase()) {
                    return false;
                }
            }

            const dueDate = parseDueDate(task);
            if (dueFilter === 'today') {
                if (!dueDate || dueDate.getTime() !== today.getTime()) {
                    return false;
                }
            }
            if (dueFilter === 'week') {
                if (!dueDate || dueDate < weekBounds.start || dueDate > weekBounds.end) {
                    return false;
                }
            }
            if (dueFilter === 'overdue') {
                if (!isOverdue(task, today)) {
                    return false;
                }
            }

            return true;
        });
    }, [tasks, statusFilter, priorityFilter, assigneeFilter, dueFilter, today, weekBounds]);

    const sortedTasks = useMemo(() => {
        const list = filteredTasks.slice();
        return list.sort((a, b) => {
            const dueA = parseDueDate(a);
            const dueB = parseDueDate(b);
            if (sortOrder === 'created-desc') {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            if (sortOrder === 'due-asc') {
                const valueA = dueA ? dueA.getTime() : Number.MAX_SAFE_INTEGER;
                const valueB = dueB ? dueB.getTime() : Number.MAX_SAFE_INTEGER;
                if (valueA === valueB) {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                }
                return valueA - valueB;
            }
            // due-desc
            const valueA = dueA ? dueA.getTime() : Number.MIN_SAFE_INTEGER;
            const valueB = dueB ? dueB.getTime() : Number.MIN_SAFE_INTEGER;
            if (valueA === valueB) {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            return valueB - valueA;
        });
    }, [filteredTasks, sortOrder]);

    const overdueCount = useMemo(() => tasks.filter(task => isOverdue(task, today)).length, [tasks, today]);

    const openCreateModal = () => {
        setEditingTaskId(null);
        setIsModalOpen(true);
    };

    const handleEditTask = (task: Task) => {
        setEditingTaskId(task.id);
        setIsModalOpen(true);
    };

    const handleSaveTask = (values: {
        title: string;
        notes?: string;
        dueDate?: string;
        assignedTo?: string;
        status: TaskStatus;
        priority: TaskPriority;
    }) => {
        if (editingTask) {
            onUpdate(editingTask.id, {
                title: values.title,
                notes: values.notes ?? null,
                dueDate: values.dueDate ?? null,
                assignedTo: values.assignedTo ?? null,
                status: values.status,
                priority: values.priority,
            });
        } else {
            onCreate(values);
        }
        setIsModalOpen(false);
        setEditingTaskId(null);
    };

    const handleUpdateStatus = (taskId: string, status: TaskStatus) => {
        onUpdate(taskId, { status });
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-purple-100/70 p-6 shadow-lg lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-indigo-500">Task Management</p>
                    <h1 className="text-2xl font-bold text-slate-800">Coordinate assignments and follow-ups</h1>
                    <p className="text-sm text-slate-600">{tasks.length} tasks • {overdueCount} overdue</p>
                </div>
                {canEdit && (
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="self-start rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                    >
                        Add Task
                    </button>
                )}
            </header>

            <section className="rounded-3xl bg-white/85 border border-white/60 shadow-lg p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
                        Status
                        <select
                            value={statusFilter}
                            onChange={event => setStatusFilter(event.target.value as 'all' | TaskStatus)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                        >
                            <option value="all">All Statuses</option>
                            {statusOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
                        Due Date
                        <select
                            value={dueFilter}
                            onChange={event => setDueFilter(event.target.value as DueFilterValue)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                        >
                            {dueFilters.map(filter => (
                                <option key={filter.value} value={filter.value}>{filter.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
                        Assignee
                        <select
                            value={assigneeFilter}
                            onChange={event => setAssigneeFilter(event.target.value as 'all' | 'unassigned' | string)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                        >
                            <option value="all">All Assignees</option>
                            <option value="unassigned">Unassigned</option>
                            {assigneeOptions.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600">
                        Priority
                        <select
                            value={priorityFilter}
                            onChange={event => setPriorityFilter(event.target.value as 'all' | TaskPriority)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                        >
                            <option value="all">All Priorities</option>
                            {priorityOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                        Sort By
                        <select
                            value={sortOrder}
                            onChange={event => setSortOrder(event.target.value as SortOption)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                        >
                            {sortOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <p className="text-xs text-slate-500">Showing {sortedTasks.length} of {tasks.length} tasks</p>
                </div>
            </section>

            <section className="rounded-3xl border border-white/60 bg-white/80 shadow-lg p-4 sm:p-6">
                {sortedTasks.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-sm text-slate-500">No tasks match the selected filters. Adjust your filters or add a new task.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {sortedTasks.map(task => {
                            const dueDate = parseDueDate(task);
                            const overdue = isOverdue(task, today);
                            const dueToday = dueDate?.getTime() === today.getTime();
                            return (
                                <button
                                    type="button"
                                    key={task.id}
                                    onClick={() => setDetailTaskId(task.id)}
                                    className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400 ${overdue ? 'border-rose-300 bg-rose-50/70' : 'border-slate-200 bg-white/80'}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-lg font-semibold text-slate-800 line-clamp-2">{task.title}</h3>
                                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(task.status)}`}>
                                            {statusOptions.find(option => option.value === task.status)?.label ?? task.status}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                        <span className={priorityTone(task.priority)}>Priority: {priorityOptions.find(option => option.value === task.priority)?.label ?? task.priority}</span>
                                        <span>Due: {formatDate(task.dueDate)}</span>
                                        <span>Assignee: {task.assignedTo || 'Unassigned'}</span>
                                    </div>
                                    {task.notes && (
                                        <p className="text-sm text-slate-600 line-clamp-3">{task.notes}</p>
                                    )}
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <p>Updated {formatDateTime(task.updatedAt)}</p>
                                        {overdue ? (
                                            <span className="text-rose-600 font-semibold">Overdue</span>
                                        ) : dueToday ? (
                                            <span className="text-amber-600 font-semibold">Due Today</span>
                                        ) : (
                                            <span className={`font-semibold ${task._sync.dirty ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {task._sync.dirty ? 'Pending sync' : 'Synced'}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <footer className="flex flex-col gap-2 rounded-3xl border border-white/60 bg-white/70 px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                {isOffline && <div className="rounded-xl bg-amber-100 px-4 py-2 text-amber-700 font-semibold">Offline – changes will sync when online.</div>}
                <p className="text-xs sm:text-sm">Last synced: <span className="font-semibold text-slate-800">{formatTimestamp(lastSyncedAt)}</span></p>
            </footer>

            <TaskModal
                visible={isModalOpen}
                initialTask={editingTask}
                assigneeOptions={assigneeOptions}
                onCancel={() => {
                    setIsModalOpen(false);
                    setEditingTaskId(null);
                }}
                onSave={handleSaveTask}
            />

            <TaskDetailDrawer
                task={detailTask}
                canEdit={canEdit}
                onClose={() => setDetailTaskId(null)}
                onEdit={handleEditTask}
                onUpdateStatus={handleUpdateStatus}
                onDelete={onDelete}
            />
        </div>
    );
};

export default TasksTab;
