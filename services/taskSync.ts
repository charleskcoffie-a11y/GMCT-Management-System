import { SHAREPOINT_SITE_URL, SHAREPOINT_TASKS_LIST_NAME } from '../constants';
import type { Task } from '../types';
import { generateId, sanitizeTask } from '../utils';
import {
    createSharePointListItem,
    deleteSharePointListItem,
    fetchSharePointListItems,
    updateSharePointListItem,
    type SharePointListColumnDefinition,
} from './sharepoint';

const TASK_COLUMNS: SharePointListColumnDefinition[] = [
    { displayName: 'JsonPayload', schema: { text: { allowMultipleLines: true } } },
    { displayName: 'Status', schema: { text: {} } },
    { displayName: 'Priority', schema: { text: {} } },
    { displayName: 'AssignedTo', schema: { text: {} } },
    { displayName: 'DueDate', schema: { dateTime: { displayAs: 'default' } } },
    { displayName: 'CreatedBy', schema: { text: {} } },
    { displayName: 'LastSyncedAt', schema: { dateTime: { displayAs: 'default' } } },
];

function normaliseDateOnly(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed.toISOString().slice(0, 10);
}

function normaliseIsoString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed.toISOString();
}

export async function loadTasksFromSharePoint(accessToken: string): Promise<Task[]> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_TASKS_LIST_NAME) {
        console.warn('SharePoint task configuration missing. Skipping remote fetch.');
        return [];
    }
    const items = await fetchSharePointListItems(accessToken, SHAREPOINT_TASKS_LIST_NAME, TASK_COLUMNS, [
        'JsonPayload',
        'Status',
        'Priority',
        'AssignedTo',
        'DueDate',
        'CreatedBy',
        'LastSyncedAt',
    ]);
    return items.map(item => {
        const fields = item.fields ?? {};
        const payload = typeof fields.JsonPayload === 'string' ? fields.JsonPayload : null;
        if (payload) {
            const parsed = (() => {
                try {
                    return JSON.parse(payload) as Task;
                } catch (error) {
                    console.warn('Unable to parse SharePoint task payload.', error);
                    return null;
                }
            })();
            if (parsed) {
                const sanitized = sanitizeTask({ ...parsed, spId: item.id ?? parsed.spId });
                const lastSyncedAt = sanitized._sync.lastSyncedAt ?? sanitized.updatedAt;
                return {
                    ...sanitized,
                    spId: item.id ?? sanitized.spId,
                    _sync: { dirty: false, lastSyncedAt },
                };
            }
        }
        const fallback = sanitizeTask({
            id: fields.TaskId || generateId('task-sp'),
            spId: item.id,
            title: fields.Title || 'Untitled Task',
            notes: undefined,
            createdBy: fields.CreatedBy || 'system',
            assignedTo: fields.AssignedTo,
            dueDate: normaliseDateOnly(fields.DueDate),
            status: fields.Status || 'Pending',
            priority: fields.Priority || 'Medium',
            createdAt: normaliseIsoString(fields.LastSyncedAt) || new Date().toISOString(),
            updatedAt: normaliseIsoString(fields.LastSyncedAt) || new Date().toISOString(),
            _sync: { dirty: false, lastSyncedAt: normaliseIsoString(fields.LastSyncedAt) },
        });
        return {
            ...fallback,
            spId: item.id ?? fallback.spId,
            _sync: { dirty: false, lastSyncedAt: fallback._sync.lastSyncedAt ?? fallback.updatedAt },
        };
    });
}

export async function upsertTaskToSharePoint(task: Task, accessToken: string): Promise<string | undefined> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_TASKS_LIST_NAME) {
        console.warn('SharePoint task configuration missing. Unable to sync task.');
        return task.spId;
    }
    const sanitized = sanitizeTask(task);
    const fields = {
        Title: sanitized.title,
        JsonPayload: JSON.stringify({ ...sanitized, spId: sanitized.spId }),
        Status: sanitized.status,
        Priority: sanitized.priority,
        AssignedTo: sanitized.assignedTo,
        DueDate: sanitized.dueDate,
        CreatedBy: sanitized.createdBy,
        LastSyncedAt: sanitized._sync.lastSyncedAt ?? sanitized.updatedAt,
    };
    if (sanitized.spId) {
        await updateSharePointListItem(accessToken, SHAREPOINT_TASKS_LIST_NAME, TASK_COLUMNS, sanitized.spId, fields);
        return sanitized.spId;
    }
    return await createSharePointListItem(accessToken, SHAREPOINT_TASKS_LIST_NAME, TASK_COLUMNS, fields);
}

export async function deleteTaskFromSharePoint(task: Task | { id: string; spId?: string }, accessToken: string): Promise<void> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_TASKS_LIST_NAME) {
        console.warn('SharePoint task configuration missing. Unable to delete remote task.');
        return;
    }
    if (!task.spId) {
        return;
    }
    await deleteSharePointListItem(accessToken, SHAREPOINT_TASKS_LIST_NAME, task.spId);
}
