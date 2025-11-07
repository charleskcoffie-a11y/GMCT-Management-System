import {
    SHAREPOINT_ENTRIES_LIST_NAME,
    SHAREPOINT_MEMBERS_LIST_NAME,
    SHAREPOINT_SITE_URL,
    SHAREPOINT_GRAPH_URL,
} from '../constants';
import type { Entry, Member, WeeklyHistoryRecord } from '../types';
import { generateId, sanitizeEntry, sanitizeMember, sanitizeWeeklyHistoryRecord } from '../utils';

type ConnectionResult = { success: true; message: string } | { success: false; message: string };

type GraphError = 'not-signed-in' | 'missing-config' | 'site-missing' | 'list-missing' | 'network-error' | 'unknown';

type SharePointListColumnDefinition = {
    displayName: string;
    schema: Record<string, unknown>;
};

type ListContext = {
    listId: string;
    ensuredColumns: Set<string>;
};

let cachedSiteId: string | null = null;
const listContextCache = new Map<string, ListContext>();

function parseSiteResource(url: string): string | null {
    try {
        const parsed = new URL(url);
        const trimmedPath = parsed.pathname.replace(/\/$/, '');
        return `${parsed.hostname}:${trimmedPath || '/'}`;
    } catch (error) {
        console.warn('Unable to parse SharePoint site URL.', error);
        return null;
    }
}

function mapErrorToMessage(error: GraphError, context?: { listName?: string }): string {
    switch (error) {
        case 'not-signed-in':
            return "You're not signed in / no permission.";
        case 'missing-config':
            return 'A required field is missing.';
        case 'list-missing':
            return context?.listName ? `The list "${context.listName}" is missing.` : 'The list is missing.';
        case 'site-missing':
            return 'The SharePoint site could not be found.';
        case 'network-error':
            return 'The internet is down.';
        default:
            return 'Unable to confirm the SharePoint connection right now.';
    }
}

function logMissingConfig(action: string): void {
    console.warn(`SharePoint configuration is incomplete. Skipping ${action}.`);
}

function buildHeaders(accessToken: string): HeadersInit {
    return {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
    };
}

function normaliseListKey(listName: string): string {
    return listName.trim().toLowerCase();
}

function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined || value === null) {
            continue;
        }
        if (typeof value === 'string' && value.trim() === '') {
            continue;
        }
        output[key] = value;
    }
    return output;
}

function safeTitle(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        return 'GMCT Item';
    }
    return trimmed.length <= 255 ? trimmed : `${trimmed.slice(0, 252)}…`;
}

function parseJsonField<T>(value: unknown): T | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    try {
        return JSON.parse(trimmed) as T;
    } catch (error) {
        console.warn('Failed to parse SharePoint JSON payload.', error);
        return null;
    }
}

function normaliseDateValue(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed.toISOString().slice(0, 10);
}

async function throwGraphError(action: string, response: Response): Promise<never> {
    let detail = '';
    try {
        const data = await response.json() as { error?: { message?: string } };
        detail = data?.error?.message ?? '';
    } catch {
        try {
            detail = await response.text();
        } catch {
            detail = '';
        }
    }

    let message: string;
    switch (response.status) {
        case 401:
        case 403:
            message = `${action} failed: access denied. Please sign in with an account that can access the SharePoint list.`;
            break;
        case 404:
            message = `${action} failed: the SharePoint resource could not be found.`;
            break;
        default:
            message = `${action} failed with status ${response.status}.`;
    }
    if (detail) {
        message += ` ${detail}`;
    }
    throw new Error(message.trim());
}

async function getSiteId(accessToken: string): Promise<string> {
    if (cachedSiteId) {
        return cachedSiteId;
    }
    if (!SHAREPOINT_SITE_URL) {
        throw new Error('SharePoint site URL is not configured.');
    }
    const siteResource = parseSiteResource(SHAREPOINT_SITE_URL);
    if (!siteResource) {
        throw new Error('SharePoint site URL is invalid. Update Settings → SharePoint configuration.');
    }
    const response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteResource}?$select=id`, {
        headers: buildHeaders(accessToken),
    });
    if (!response.ok) {
        await throwGraphError('Resolving SharePoint site', response);
    }
    const data = await response.json() as { id?: string };
    if (!data.id) {
        throw new Error('SharePoint site lookup returned an unexpected response.');
    }
    cachedSiteId = data.id;
    return data.id;
}

async function getListContext(accessToken: string, listName: string): Promise<{ siteId: string; context: ListContext }> {
    const key = normaliseListKey(listName);
    const existing = listContextCache.get(key);
    const siteId = await getSiteId(accessToken);
    if (existing) {
        return { siteId, context: existing };
    }

    const escaped = listName.replace(/'/g, "''");
    const filter = encodeURIComponent(`displayName eq '${escaped}'`);
    const response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists?$select=id,displayName&$filter=${filter}`, {
        headers: buildHeaders(accessToken),
    });
    if (!response.ok) {
        await throwGraphError(`Fetching SharePoint list "${listName}"`, response);
    }
    const data = await response.json() as { value?: Array<{ id: string; displayName: string }> };
    const match = data.value?.find(item => normaliseListKey(item.displayName) === key);
    if (!match) {
        throw new Error(`SharePoint list "${listName}" was not found on the configured site.`);
    }
    const context: ListContext = { listId: match.id, ensuredColumns: new Set() };
    listContextCache.set(key, context);
    return { siteId, context };
}

async function ensureColumns(accessToken: string, siteId: string, context: ListContext, columns: SharePointListColumnDefinition[]): Promise<void> {
    if (!columns.length) {
        return;
    }
    const pending = columns.filter(column => !context.ensuredColumns.has(normaliseListKey(column.displayName)));
    if (!pending.length) {
        return;
    }
    const response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${context.listId}/columns?$select=displayName`, {
        headers: buildHeaders(accessToken),
    });
    if (!response.ok) {
        await throwGraphError('Reading SharePoint list columns', response);
    }
    const data = await response.json() as { value?: Array<{ displayName: string }> };
    const existing = new Set<string>();
    for (const column of data.value ?? []) {
        existing.add(normaliseListKey(column.displayName));
    }
    for (const definition of pending) {
        const key = normaliseListKey(definition.displayName);
        if (existing.has(key)) {
            context.ensuredColumns.add(key);
            continue;
        }
        const payload = { displayName: definition.displayName, ...definition.schema };
        const createResponse = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${context.listId}/columns`, {
            method: 'POST',
            headers: {
                ...buildHeaders(accessToken),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!createResponse.ok) {
            await throwGraphError(`Creating SharePoint column "${definition.displayName}"`, createResponse);
        }
        context.ensuredColumns.add(key);
    }
}

export function resetContextCache(): void {
    cachedSiteId = null;
    listContextCache.clear();
}

export async function ensureSharePointListReady(accessToken: string, listName: string, columns: SharePointListColumnDefinition[] = []): Promise<{ siteId: string; listId: string }> {
    const { siteId, context } = await getListContext(accessToken, listName);
    await ensureColumns(accessToken, siteId, context, columns);
    return { siteId, listId: context.listId };
}

export async function fetchSharePointListItems(accessToken: string, listName: string, columns: SharePointListColumnDefinition[], selectFields: string[]): Promise<any[]> {
    const { siteId, listId } = await ensureSharePointListReady(accessToken, listName, columns);
    const requested = Array.from(new Set([...selectFields, 'Title']));
    const expand = encodeURIComponent(`fields($select=${requested.join(',')})`);
    const headers = buildHeaders(accessToken);
    const items: any[] = [];
    let url: string | null = `${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${listId}/items?$top=200&$expand=${expand}`;
    while (url) {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            await throwGraphError(`Fetching items from SharePoint list "${listName}"`, response);
        }
        const data = await response.json() as { value?: any[]; '@odata.nextLink'?: string };
        if (Array.isArray(data.value)) {
            items.push(...data.value);
        }
        url = data['@odata.nextLink'] ?? null;
    }
    return items;
}

export async function createSharePointListItem(accessToken: string, listName: string, columns: SharePointListColumnDefinition[], fields: Record<string, unknown>): Promise<string | undefined> {
    const { siteId, listId } = await ensureSharePointListReady(accessToken, listName, columns);
    const payload = { fields: cleanFields(fields) };
    const response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${listId}/items`, {
        method: 'POST',
        headers: {
            ...buildHeaders(accessToken),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        await throwGraphError(`Creating item in SharePoint list "${listName}"`, response);
    }
    const data = await response.json() as { id?: string };
    return typeof data.id === 'string' ? data.id : undefined;
}

export async function updateSharePointListItem(accessToken: string, listName: string, columns: SharePointListColumnDefinition[], itemId: string, fields: Record<string, unknown>): Promise<void> {
    if (!itemId) {
        return;
    }
    const { siteId, listId } = await ensureSharePointListReady(accessToken, listName, columns);
    const response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${listId}/items/${itemId}/fields`, {
        method: 'PATCH',
        headers: {
            ...buildHeaders(accessToken),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanFields(fields)),
    });
    if (!response.ok) {
        await throwGraphError(`Updating item ${itemId} in SharePoint list "${listName}"`, response);
    }
}

export async function deleteSharePointListItem(accessToken: string, listName: string, itemId: string): Promise<void> {
    if (!itemId) {
        return;
    }
    const { siteId, listId } = await getListContext(accessToken, listName);
    const response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${listId}/items/${itemId}`, {
        method: 'DELETE',
        headers: buildHeaders(accessToken),
    });
    if (!response.ok && response.status !== 404) {
        await throwGraphError(`Deleting item ${itemId} from SharePoint list "${listName}"`, response);
    }
}

const ENTRY_COLUMNS: SharePointListColumnDefinition[] = [
    { displayName: 'JsonPayload', schema: { text: { allowMultipleLines: true } } },
    { displayName: 'MemberID', schema: { text: {} } },
    { displayName: 'EntryDate', schema: { dateTime: { displayAs: 'default' } } },
    { displayName: 'EntryType', schema: { text: {} } },
    { displayName: 'Fund', schema: { text: {} } },
    { displayName: 'Method', schema: { text: {} } },
    { displayName: 'Amount', schema: { number: { decimalPlaces: 2 } } },
    { displayName: 'Note', schema: { text: { allowMultipleLines: true } } },
];

const MEMBER_COLUMNS: SharePointListColumnDefinition[] = [
    { displayName: 'JsonPayload', schema: { text: { allowMultipleLines: true } } },
    { displayName: 'MemberID', schema: { text: {} } },
    { displayName: 'ClassNumber', schema: { text: {} } },
];

const HISTORY_COLUMNS: SharePointListColumnDefinition[] = [
    { displayName: 'JsonPayload', schema: { text: { allowMultipleLines: true } } },
    { displayName: 'ServiceDate', schema: { dateTime: { displayAs: 'default' } } },
    { displayName: 'SocietyName', schema: { text: {} } },
];

export async function loadEntriesFromSharePoint(accessToken: string): Promise<Entry[]> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_ENTRIES_LIST_NAME) {
        logMissingConfig('loading entries from SharePoint');
        return [];
    }
    const items = await fetchSharePointListItems(accessToken, SHAREPOINT_ENTRIES_LIST_NAME, ENTRY_COLUMNS, [
        'JsonPayload',
        'MemberID',
        'EntryDate',
        'EntryType',
        'Fund',
        'Method',
        'Amount',
        'Note',
    ]);
    return items.map(item => {
        const fields = item.fields ?? {};
        const payload = parseJsonField<Entry>(fields.JsonPayload);
        if (payload) {
            const sanitized = sanitizeEntry({ ...payload, spId: item.id ?? payload.spId });
            sanitized.spId = item.id ?? sanitized.spId;
            return sanitized;
        }
        const fallback: Entry = sanitizeEntry({
            id: fields.MemberID || generateId('entry-sp'),
            spId: item.id,
            date: normaliseDateValue(fields.EntryDate) ?? new Date().toISOString().slice(0, 10),
            memberID: fields.MemberID || 'unknown-member',
            memberName: fields.Title || 'Unknown Member',
            type: fields.EntryType || 'other',
            fund: fields.Fund || 'General Fund',
            method: fields.Method || 'cash',
            amount: typeof fields.Amount === 'number' ? fields.Amount : Number(fields.Amount) || 0,
            note: fields.Note,
        });
        fallback.spId = item.id ?? fallback.spId;
        return fallback;
    });
}

export async function loadMembersFromSharePoint(accessToken: string): Promise<Member[]> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_MEMBERS_LIST_NAME) {
        logMissingConfig('loading members from SharePoint');
        return [];
    }
    const items = await fetchSharePointListItems(accessToken, SHAREPOINT_MEMBERS_LIST_NAME, MEMBER_COLUMNS, [
        'JsonPayload',
        'MemberID',
        'ClassNumber',
    ]);
    return items.map(item => {
        const fields = item.fields ?? {};
        const payload = parseJsonField<Member>(fields.JsonPayload);
        if (payload) {
            const sanitized = sanitizeMember({ ...payload, spId: item.id ?? payload.spId });
            sanitized.spId = item.id ?? sanitized.spId;
            return sanitized;
        }
        const fallback: Member = sanitizeMember({
            id: fields.MemberID || generateId('member-sp'),
            spId: item.id,
            name: fields.Title || 'Unnamed Member',
            classNumber: fields.ClassNumber,
        });
        fallback.spId = item.id ?? fallback.spId;
        return fallback;
    });
}

export async function upsertEntryToSharePoint(entry: Entry, accessToken: string): Promise<string | undefined> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_ENTRIES_LIST_NAME) {
        logMissingConfig('upserting an entry to SharePoint');
        return entry.spId;
    }
    const sanitized = sanitizeEntry(entry);
    const title = sanitized.memberName
        ? `${sanitized.memberName} – ${sanitized.date}`
        : `Entry ${sanitized.date}`;
    const fields = {
        Title: safeTitle(title),
        JsonPayload: JSON.stringify({ ...sanitized, spId: sanitized.spId }),
        MemberID: sanitized.memberID,
        EntryDate: sanitized.date,
        EntryType: sanitized.type,
        Fund: sanitized.fund,
        Method: sanitized.method,
        Amount: sanitized.amount,
        Note: sanitized.note,
    };
    if (sanitized.spId) {
        await updateSharePointListItem(accessToken, SHAREPOINT_ENTRIES_LIST_NAME, ENTRY_COLUMNS, sanitized.spId, fields);
        return sanitized.spId;
    }
    return await createSharePointListItem(accessToken, SHAREPOINT_ENTRIES_LIST_NAME, ENTRY_COLUMNS, fields);
}

export async function deleteEntryFromSharePoint(entry: Entry, accessToken: string): Promise<void> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_ENTRIES_LIST_NAME) {
        logMissingConfig('deleting an entry from SharePoint');
        return;
    }
    if (!entry.spId) {
        return;
    }
    await deleteSharePointListItem(accessToken, SHAREPOINT_ENTRIES_LIST_NAME, entry.spId);
}

export async function upsertMemberToSharePoint(member: Member, accessToken: string): Promise<string | undefined> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_MEMBERS_LIST_NAME) {
        logMissingConfig('upserting a member to SharePoint');
        return member.spId;
    }
    const sanitized = sanitizeMember(member);
    const fields = {
        Title: safeTitle(sanitized.name || 'Member'),
        JsonPayload: JSON.stringify({ ...sanitized, spId: sanitized.spId }),
        MemberID: sanitized.id,
        ClassNumber: sanitized.classNumber,
    };
    if (sanitized.spId) {
        await updateSharePointListItem(accessToken, SHAREPOINT_MEMBERS_LIST_NAME, MEMBER_COLUMNS, sanitized.spId, fields);
        return sanitized.spId;
    }
    return await createSharePointListItem(accessToken, SHAREPOINT_MEMBERS_LIST_NAME, MEMBER_COLUMNS, fields);
}

export async function deleteMemberFromSharePoint(member: Member, accessToken: string): Promise<void> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_MEMBERS_LIST_NAME) {
        logMissingConfig('deleting a member from SharePoint');
        return;
    }
    if (!member.spId) {
        return;
    }
    await deleteSharePointListItem(accessToken, SHAREPOINT_MEMBERS_LIST_NAME, member.spId);
}

export async function loadWeeklyHistoryFromSharePoint(accessToken: string, listName: string): Promise<WeeklyHistoryRecord[]> {
    if (!SHAREPOINT_SITE_URL || !listName) {
        logMissingConfig('loading weekly history from SharePoint');
        return [];
    }
    const items = await fetchSharePointListItems(accessToken, listName, HISTORY_COLUMNS, [
        'JsonPayload',
        'ServiceDate',
        'SocietyName',
    ]);
    return items.map(item => {
        const fields = item.fields ?? {};
        const payload = parseJsonField<WeeklyHistoryRecord>(fields.JsonPayload);
        if (payload) {
            const sanitized = sanitizeWeeklyHistoryRecord({ ...payload, spId: item.id ?? (payload as any).spId });
            sanitized.spId = item.id ?? sanitized.spId;
            return sanitized;
        }
        const fallback: WeeklyHistoryRecord = sanitizeWeeklyHistoryRecord({
            id: generateId('history-sp'),
            spId: item.id,
            dateOfService: normaliseDateValue(fields.ServiceDate) ?? new Date().toISOString().slice(0, 10),
            societyName: fields.SocietyName || '',
            preacher: '',
            guestPreacher: false,
            preacherSociety: '',
            liturgist: '',
            serviceType: 'divine-service',
            serviceTypeOther: '',
            sermonTopic: '',
            memoryText: '',
            sermonSummary: '',
            worshipHighlights: '',
            announcementsBy: '',
            announcementsKeyPoints: '',
            attendance: {
                adultsMale: 0,
                adultsFemale: 0,
                children: 0,
                adherents: 0,
                catechumens: 0,
                visitors: {
                    total: 0,
                    names: '',
                    specialVisitorName: '',
                    specialVisitorPosition: '',
                    specialVisitorSummary: '',
                },
            },
            newMembersDetails: '',
            newMembersContact: '',
            donations: { description: '', quantity: '', donatedBy: '' },
            events: '',
            observations: '',
            preparedBy: '',
        });
        fallback.spId = item.id ?? fallback.spId;
        return fallback;
    });
}

export async function upsertWeeklyHistoryToSharePoint(record: WeeklyHistoryRecord, accessToken: string, listName: string): Promise<string | undefined> {
    if (!SHAREPOINT_SITE_URL || !listName) {
        logMissingConfig('upserting weekly history to SharePoint');
        return record.spId;
    }
    const sanitized = sanitizeWeeklyHistoryRecord(record);
    const titleSource = sanitized.societyName
        ? `${sanitized.societyName} – ${sanitized.dateOfService}`
        : `Weekly History ${sanitized.dateOfService}`;
    const fields = {
        Title: safeTitle(titleSource),
        JsonPayload: JSON.stringify({ ...sanitized, spId: sanitized.spId }),
        ServiceDate: sanitized.dateOfService,
        SocietyName: sanitized.societyName,
    };
    if (sanitized.spId) {
        await updateSharePointListItem(accessToken, listName, HISTORY_COLUMNS, sanitized.spId, fields);
        return sanitized.spId;
    }
    return await createSharePointListItem(accessToken, listName, HISTORY_COLUMNS, fields);
}

export async function deleteWeeklyHistoryFromSharePoint(record: WeeklyHistoryRecord, accessToken: string, listName: string): Promise<void> {
    if (!SHAREPOINT_SITE_URL || !listName) {
        logMissingConfig('deleting weekly history from SharePoint');
        return;
    }
    if (!record.spId) {
        return;
    }
    await deleteSharePointListItem(accessToken, listName, record.spId);
}

export async function testSharePointConnection(accessToken?: string | null): Promise<ConnectionResult> {
    if (!accessToken) {
        return { success: false, message: mapErrorToMessage('not-signed-in') };
    }

    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_ENTRIES_LIST_NAME || !SHAREPOINT_MEMBERS_LIST_NAME) {
        return { success: false, message: mapErrorToMessage('missing-config') };
    }

    const siteResource = parseSiteResource(SHAREPOINT_SITE_URL);
    if (!siteResource) {
        return { success: false, message: mapErrorToMessage('missing-config') };
    }

    try {
        const siteResponse = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteResource}?$select=id`, {
            headers: buildHeaders(accessToken),
        });

        if (siteResponse.status === 401 || siteResponse.status === 403) {
            return { success: false, message: mapErrorToMessage('not-signed-in') };
        }

        if (siteResponse.status === 404) {
            return { success: false, message: mapErrorToMessage('site-missing') };
        }

        if (!siteResponse.ok) {
            console.error('Unexpected response when fetching SharePoint site info.', siteResponse.status, siteResponse.statusText);
            return { success: false, message: mapErrorToMessage('unknown') };
        }

        const siteData = await siteResponse.json() as { id?: string };
        const siteId = siteData.id;
        if (!siteId) {
            return { success: false, message: mapErrorToMessage('unknown') };
        }

        const listNames = [SHAREPOINT_ENTRIES_LIST_NAME, SHAREPOINT_MEMBERS_LIST_NAME];
        for (const listName of listNames) {
            const listResponse = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${encodeURIComponent(listName)}`, {
                headers: buildHeaders(accessToken),
            });

            if (listResponse.status === 401 || listResponse.status === 403) {
                return { success: false, message: mapErrorToMessage('not-signed-in') };
            }

            if (listResponse.status === 404) {
                return { success: false, message: mapErrorToMessage('list-missing', { listName }) };
            }

            if (!listResponse.ok) {
                console.error('Unexpected response when fetching SharePoint list info.', listResponse.status, listResponse.statusText);
                return { success: false, message: mapErrorToMessage('unknown') };
            }
        }

        return { success: true, message: 'Connected.' };
    } catch (error) {
        console.error('Failed to test SharePoint connection', error);
        if (error instanceof TypeError) {
            return { success: false, message: mapErrorToMessage('network-error') };
        }
        return { success: false, message: mapErrorToMessage('unknown') };
    }
}

export type { SharePointListColumnDefinition };
