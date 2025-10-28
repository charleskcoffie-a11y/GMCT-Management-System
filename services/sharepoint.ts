import { SHAREPOINT_ENTRIES_LIST_NAME, SHAREPOINT_MEMBERS_LIST_NAME, SHAREPOINT_SITE_URL, SHAREPOINT_GRAPH_URL } from '../constants';
import type { Entry, Member } from '../types';
import { sanitizeEntryType, sanitizeMethod } from '../utils';

type ConnectionResult = { success: true; message: string } | { success: false; message: string };

type GraphError = 'not-signed-in' | 'missing-config' | 'site-missing' | 'list-missing' | 'network-error' | 'unknown';

type SharePointContext = {
    siteId: string;
    entriesListId: string;
    membersListId: string;
};

type SharePointListItem<T extends Record<string, unknown>> = {
    id: string;
    fields: T & { Title?: string };
};

const REQUIRED_ENTRY_COLUMNS: Array<{ name: string; definition: Record<string, unknown> }> = [
    { name: 'GMCTId', definition: { text: {} } },
    { name: 'GMCTDate', definition: { dateTime: { format: 'dateOnly' } } },
    { name: 'GMCTMemberId', definition: { text: {} } },
    { name: 'GMCTMemberName', definition: { text: {} } },
    { name: 'GMCTType', definition: { text: {} } },
    { name: 'GMCTFund', definition: { text: {} } },
    { name: 'GMCTMethod', definition: { text: {} } },
    { name: 'GMCTAmount', definition: { number: { decimalPlaces: 2 } } },
    { name: 'GMCTNote', definition: { text: { allowMultipleLines: true } } },
];

const GRAPH_HEADERS = (accessToken: string) => ({
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
});

let cachedContext: SharePointContext | null = null;

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

export async function testSharePointConnection(accessToken?: string | null): Promise<ConnectionResult> {
    if (!accessToken) {
        return { success: false, message: mapErrorToMessage('not-signed-in') };
    }

    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_ENTRIES_LIST_NAME || !SHAREPOINT_MEMBERS_LIST_NAME) {
        return { success: false, message: mapErrorToMessage('missing-config') };
    }

    try {
        await resolveContext(accessToken);
        return { success: true, message: 'Connected.' };
    } catch (error) {
        console.error('Failed to test SharePoint connection', error);
        if (error instanceof TypeError) {
            return { success: false, message: mapErrorToMessage('network-error') };
        }
        return { success: false, message: mapErrorToMessage('unknown') };
    }
}

async function resolveContext(accessToken: string): Promise<SharePointContext> {
    if (cachedContext) {
        return cachedContext;
    }

    const siteResource = parseSiteResource(SHAREPOINT_SITE_URL ?? '');
    if (!siteResource) {
        throw new Error(mapErrorToMessage('missing-config'));
    }

    const siteResponse = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteResource}?$select=id`, {
        headers: GRAPH_HEADERS(accessToken),
    });

    if (siteResponse.status === 401 || siteResponse.status === 403) {
        throw new Error(mapErrorToMessage('not-signed-in'));
    }
    if (siteResponse.status === 404) {
        throw new Error(mapErrorToMessage('site-missing'));
    }
    if (!siteResponse.ok) {
        throw new Error(mapErrorToMessage('unknown'));
    }

    const siteData = await siteResponse.json() as { id?: string };
    const siteId = siteData.id;
    if (!siteId) {
        throw new Error(mapErrorToMessage('unknown'));
    }

    const entriesList = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${encodeURIComponent(SHAREPOINT_ENTRIES_LIST_NAME)}`,
        { headers: GRAPH_HEADERS(accessToken) });
    if (entriesList.status === 404) {
        throw new Error(mapErrorToMessage('list-missing', { listName: SHAREPOINT_ENTRIES_LIST_NAME }));
    }
    if (!entriesList.ok) {
        throw new Error(mapErrorToMessage(entriesList.status === 401 || entriesList.status === 403 ? 'not-signed-in' : 'unknown'));
    }
    const { id: entriesListId } = await entriesList.json() as { id?: string };
    if (!entriesListId) {
        throw new Error(mapErrorToMessage('unknown'));
    }

    const membersList = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${encodeURIComponent(SHAREPOINT_MEMBERS_LIST_NAME)}`,
        { headers: GRAPH_HEADERS(accessToken) });
    if (membersList.status === 404) {
        throw new Error(mapErrorToMessage('list-missing', { listName: SHAREPOINT_MEMBERS_LIST_NAME }));
    }
    if (!membersList.ok) {
        throw new Error(mapErrorToMessage(membersList.status === 401 || membersList.status === 403 ? 'not-signed-in' : 'unknown'));
    }
    const { id: membersListId } = await membersList.json() as { id?: string };
    if (!membersListId) {
        throw new Error(mapErrorToMessage('unknown'));
    }

    cachedContext = { siteId, entriesListId, membersListId };
    await ensureEntryColumns(accessToken, cachedContext);
    return cachedContext;
}

async function ensureEntryColumns(accessToken: string, context: SharePointContext): Promise<void> {
    try {
        const response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${context.siteId}/lists/${context.entriesListId}/columns?$select=name`, {
            headers: GRAPH_HEADERS(accessToken),
        });
        if (!response.ok) {
            return;
        }
        const payload = await response.json() as { value?: Array<{ name?: string }> };
        const existing = new Set((payload.value ?? []).map(column => column.name));
        for (const column of REQUIRED_ENTRY_COLUMNS) {
            if (!existing.has(column.name)) {
                await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${context.siteId}/lists/${context.entriesListId}/columns`, {
                    method: 'POST',
                    headers: GRAPH_HEADERS(accessToken),
                    body: JSON.stringify({ name: column.name, ...column.definition }),
                }).catch(error => {
                    console.warn(`Unable to ensure SharePoint column ${column.name}`, error);
                });
            }
        }
    } catch (error) {
        console.warn('Unable to validate SharePoint columns.', error);
    }
}

function mapEntryItem(item: SharePointListItem<Record<string, unknown>>): Entry {
    const fields = item.fields ?? {};
    const typeRaw = typeof fields.GMCTType === 'string' ? fields.GMCTType : 'other';
    const methodRaw = typeof fields.GMCTMethod === 'string' ? fields.GMCTMethod : 'cash';
    return {
        id: String(fields.GMCTId ?? fields.ID ?? fields.Id ?? item.id ?? ''),
        spId: item.id,
        date: typeof fields.GMCTDate === 'string' ? fields.GMCTDate : '',
        memberID: typeof fields.GMCTMemberId === 'string' ? fields.GMCTMemberId : '',
        memberName: typeof fields.GMCTMemberName === 'string' ? fields.GMCTMemberName : (typeof fields.Title === 'string' ? fields.Title : ''),
        type: sanitizeEntryType(typeRaw),
        fund: typeof fields.GMCTFund === 'string' ? fields.GMCTFund : 'General',
        method: sanitizeMethod(methodRaw),
        amount: Number(fields.GMCTAmount ?? 0) || 0,
        note: typeof fields.GMCTNote === 'string' ? fields.GMCTNote : '',
    };
}

function mapMemberItem(item: SharePointListItem<Record<string, unknown>>): Member {
    const fields = item.fields ?? {};
    const identifier = typeof fields.ID === 'string' && fields.ID ? fields.ID : item.id;
    return {
        id: identifier,
        spId: item.id,
        name: typeof fields.Name === 'string' && fields.Name ? fields.Name : (typeof fields.Title === 'string' ? fields.Title : ''),
        classNumber: typeof fields.ClassNumber === 'string' ? fields.ClassNumber : '',
    };
}

async function fetchListItems<T extends Record<string, unknown>>(accessToken: string, listId: string, siteId: string): Promise<Array<SharePointListItem<T>>> {
    const response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${listId}/items?expand=fields&$top=5000`, {
        headers: GRAPH_HEADERS(accessToken),
    });
    if (!response.ok) {
        throw new Error('Unable to fetch SharePoint list items.');
    }
    const data = await response.json() as { value?: Array<SharePointListItem<T>> };
    return data.value ?? [];
}

async function findItemIdByField(accessToken: string, context: SharePointContext, listId: string, field: string, value: string): Promise<string | null> {
    const filterValue = encodeURIComponent(value.replace(/'/g, "''"));
    const response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${context.siteId}/lists/${listId}/items?expand=fields&$filter=fields/${field} eq '${filterValue}'&$top=1`, {
        headers: GRAPH_HEADERS(accessToken),
    });
    if (!response.ok) {
        return null;
    }
    const data = await response.json() as { value?: Array<SharePointListItem<Record<string, unknown>>> };
    const [item] = data.value ?? [];
    return item?.id ?? null;
}

export async function loadEntriesFromSharePoint(accessToken: string): Promise<Entry[]> {
    const context = await resolveContext(accessToken);
    const items = await fetchListItems<Record<string, unknown>>(accessToken, context.entriesListId, context.siteId);
    return items.map(mapEntryItem);
}

export async function loadMembersFromSharePoint(accessToken: string): Promise<Member[]> {
    const context = await resolveContext(accessToken);
    const items = await fetchListItems<Record<string, unknown>>(accessToken, context.membersListId, context.siteId);
    return items.map(mapMemberItem);
}

export async function upsertEntryToSharePoint(entry: Entry, accessToken: string): Promise<string | undefined> {
    const context = await resolveContext(accessToken);
    const payload = {
        Title: entry.memberName || entry.id,
        GMCTId: entry.id,
        GMCTDate: entry.date,
        GMCTMemberId: entry.memberID,
        GMCTMemberName: entry.memberName,
        GMCTType: entry.type,
        GMCTFund: entry.fund,
        GMCTMethod: entry.method,
        GMCTAmount: entry.amount,
        GMCTNote: entry.note ?? '',
    };

    const itemId = entry.spId || await findItemIdByField(accessToken, context, context.entriesListId, 'GMCTId', entry.id);
    if (itemId) {
        await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${context.siteId}/lists/${context.entriesListId}/items/${itemId}/fields`, {
            method: 'PATCH',
            headers: GRAPH_HEADERS(accessToken),
            body: JSON.stringify(payload),
        });
        return itemId;
    }

    const response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${context.siteId}/lists/${context.entriesListId}/items`, {
        method: 'POST',
        headers: GRAPH_HEADERS(accessToken),
        body: JSON.stringify({ fields: payload }),
    });
    if (!response.ok) {
        throw new Error('Unable to create SharePoint entry.');
    }
    const data = await response.json() as SharePointListItem<Record<string, unknown>>;
    return data.id;
}

export async function deleteEntryFromSharePoint(entry: Entry, accessToken: string): Promise<void> {
    const context = await resolveContext(accessToken);
    const itemId = entry.spId || await findItemIdByField(accessToken, context, context.entriesListId, 'GMCTId', entry.id);
    if (!itemId) {
        return;
    }
    await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${context.siteId}/lists/${context.entriesListId}/items/${itemId}`, {
        method: 'DELETE',
        headers: GRAPH_HEADERS(accessToken),
    });
}

export async function upsertMemberToSharePoint(member: Member, accessToken: string): Promise<string | undefined> {
    const context = await resolveContext(accessToken);
    const payload = {
        Title: member.name || member.id,
        Name: member.name || member.id,
        ID: member.id,
        ClassNumber: member.classNumber ?? '',
    };

    const itemId = member.spId || await findItemIdByField(accessToken, context, context.membersListId, 'ID', member.id);
    if (itemId) {
        await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${context.siteId}/lists/${context.membersListId}/items/${itemId}/fields`, {
            method: 'PATCH',
            headers: GRAPH_HEADERS(accessToken),
            body: JSON.stringify(payload),
        });
        return itemId;
    }

    const response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${context.siteId}/lists/${context.membersListId}/items`, {
        method: 'POST',
        headers: GRAPH_HEADERS(accessToken),
        body: JSON.stringify({ fields: payload }),
    });
    if (!response.ok) {
        throw new Error('Unable to create SharePoint member.');
    }
    const data = await response.json() as SharePointListItem<Record<string, unknown>>;
    return data.id;
}

export async function deleteMemberFromSharePoint(member: Member, accessToken: string): Promise<void> {
    const context = await resolveContext(accessToken);
    const itemId = member.spId || await findItemIdByField(accessToken, context, context.membersListId, 'ID', member.id);
    if (!itemId) {
        return;
    }
    await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${context.siteId}/lists/${context.membersListId}/items/${itemId}`, {
        method: 'DELETE',
        headers: GRAPH_HEADERS(accessToken),
    });
}

export function resetContextCache(): void {
    cachedContext = null;
}
