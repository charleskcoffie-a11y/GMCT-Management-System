import { SHAREPOINT_SITE_URL, SHAREPOINT_TASKS_LIST_NAME } from '../constants';
import type { Task } from '../types';

export async function loadTasksFromSharePoint(_accessToken: string): Promise<Task[]> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_TASKS_LIST_NAME) {
        console.warn('SharePoint task configuration missing. Skipping remote fetch.');
        return [];
    }
    console.info('Task SharePoint integration not implemented. Returning empty task list.');
    return [];
}

export async function upsertTaskToSharePoint(task: Task, _accessToken: string): Promise<string | undefined> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_TASKS_LIST_NAME) {
        console.warn('SharePoint task configuration missing. Unable to sync task.');
        return task.spId;
    }
    console.info('Task sync to SharePoint is not implemented. Task changes remain local.');
    return task.spId;
}

export async function deleteTaskFromSharePoint(_task: Task | { id: string; spId?: string }, _accessToken: string): Promise<void> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_TASKS_LIST_NAME) {
        console.warn('SharePoint task configuration missing. Unable to delete remote task.');
        return;
    }
    console.info('Task deletion on SharePoint is not implemented.');
}
