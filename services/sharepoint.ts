import { SHAREPOINT_ENTRIES_LIST_NAME, SHAREPOINT_MEMBERS_LIST_NAME, SHAREPOINT_SITE_URL, SHAREPOINT_GRAPH_URL } from '../constants';
import type { Entry, Member } from '../types';

type ConnectionResult = { success: true; message: string } | { success: false; message: string };

type GraphError = 'not-signed-in' | 'missing-config' | 'site-missing' | 'list-missing' | 'network-error' | 'unknown';

type SharePointConnectionOverrides = {
    siteUrl?: string;
    entriesListName?: string;
    membersListName?: string;
};

type ResolveListUrlOptions = {
    siteUrl?: string;
    listName?: string;
};

class SharePointGraphError extends Error {
    code: GraphError;

    constructor(code: GraphError) {
        super(code);
        this.name = 'SharePointGraphError';
        this.code = code;
    }
}

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
            return 'Access denied. Make sure you are signed in with a Microsoft 365 account that has permission to view this SharePoint list.';
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

export function resetContextCache(): void {
    siteCache = null;
}

let siteCache: { siteUrl: string; resource: string; siteId: string } | null = null;

function buildSharePointConfig(overrides?: SharePointConnectionOverrides): { siteUrl: string; entriesListName: string; membersListName: string } | null {
    const siteUrl = (overrides?.siteUrl ?? SHAREPOINT_SITE_URL)?.trim();
    const entriesListName = (overrides?.entriesListName ?? SHAREPOINT_ENTRIES_LIST_NAME)?.trim();
    const membersListName = (overrides?.membersListName ?? SHAREPOINT_MEMBERS_LIST_NAME)?.trim();
    if (!siteUrl || !entriesListName || !membersListName) {
        return null;
    }
    return { siteUrl, entriesListName, membersListName };
}

function buildListUrl(siteUrl: string, listName: string): string {
    try {
        const url = new URL(siteUrl);
        url.pathname = `${url.pathname.replace(/\/$/, '')}/Lists/${encodeURIComponent(listName)}/AllItems.aspx`;
        return url.toString();
    } catch (error) {
        console.error('Invalid SharePoint site URL configuration', error);
        return `${siteUrl.replace(/\/$/, '')}/Lists/${encodeURIComponent(listName)}/AllItems.aspx`;
    }
}

async function fetchSiteId(accessToken: string, siteUrl: string): Promise<string> {
    const resource = parseSiteResource(siteUrl);
    if (!resource) {
        throw new SharePointGraphError('missing-config');
    }

    if (siteCache && siteCache.siteUrl === siteUrl && siteCache.resource === resource) {
        return siteCache.siteId;
    }

    let response: Response;
    try {
        response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${resource}?$select=id`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
    } catch (error) {
        if (error instanceof TypeError) {
            throw new SharePointGraphError('network-error');
        }
        throw error;
    }

    if (response.status === 401 || response.status === 403) {
        throw new SharePointGraphError('not-signed-in');
    }

    if (response.status === 404) {
        throw new SharePointGraphError('site-missing');
    }

    if (!response.ok) {
        console.error('Unexpected response when fetching SharePoint site info.', response.status, response.statusText);
        throw new SharePointGraphError('unknown');
    }

    const data = (await response.json()) as { id?: string };
    if (!data.id) {
        throw new SharePointGraphError('unknown');
    }

    siteCache = { siteUrl, resource, siteId: data.id };
    return data.id;
}

async function fetchList(accessToken: string, siteId: string, listName: string, select?: string) {
    const selectParam = select ? `?$select=${select}` : '';
    let response: Response;
    try {
        response = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${encodeURIComponent(listName)}${selectParam}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
    } catch (error) {
        if (error instanceof TypeError) {
            throw new SharePointGraphError('network-error');
        }
        throw error;
    }

    if (response.status === 401 || response.status === 403) {
        throw new SharePointGraphError('not-signed-in');
    }

    if (response.status === 404) {
        throw new SharePointGraphError('list-missing');
    }

    if (!response.ok) {
        console.error('Unexpected response when fetching SharePoint list info.', response.status, response.statusText);
        throw new SharePointGraphError('unknown');
    }

    return response.json();
}

export async function loadEntriesFromSharePoint(_accessToken: string): Promise<Entry[]> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_ENTRIES_LIST_NAME) {
        logMissingConfig('loading entries from SharePoint');
        return [];
    }

    console.info('SharePoint sync is not fully implemented. Returning cached entries only.');
    return [];
}

export async function loadMembersFromSharePoint(_accessToken: string): Promise<Member[]> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_MEMBERS_LIST_NAME) {
        logMissingConfig('loading members from SharePoint');
        return [];
    }

    console.info('SharePoint sync is not fully implemented. Returning cached members only.');
    return [];
}

export async function upsertEntryToSharePoint(entry: Entry, _accessToken: string): Promise<string | undefined> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_ENTRIES_LIST_NAME) {
        logMissingConfig('upserting an entry to SharePoint');
        return entry.spId;
    }

    console.info('SharePoint entry sync is not implemented. Entry changes remain local only.');
    return entry.spId;
}

export async function deleteEntryFromSharePoint(_entry: Entry, _accessToken: string): Promise<void> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_ENTRIES_LIST_NAME) {
        logMissingConfig('deleting an entry from SharePoint');
        return;
    }

    console.info('SharePoint entry deletion is not implemented. No remote changes were made.');
}

export async function upsertMemberToSharePoint(member: Member, _accessToken: string): Promise<string | undefined> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_MEMBERS_LIST_NAME) {
        logMissingConfig('upserting a member to SharePoint');
        return member.spId;
    }

    console.info('SharePoint member sync is not implemented. Member changes remain local only.');
    return member.spId;
}

export async function deleteMemberFromSharePoint(_member: Member, _accessToken: string): Promise<void> {
    if (!SHAREPOINT_SITE_URL || !SHAREPOINT_MEMBERS_LIST_NAME) {
        logMissingConfig('deleting a member from SharePoint');
        return;
    }

    console.info('SharePoint member deletion is not implemented. No remote changes were made.');
}

export async function testSharePointConnection(accessToken?: string | null, overrides?: SharePointConnectionOverrides): Promise<ConnectionResult> {
    if (!accessToken) {
        return { success: false, message: mapErrorToMessage('not-signed-in') };
    }

    const config = buildSharePointConfig(overrides);
    if (!config) {
        return { success: false, message: mapErrorToMessage('missing-config') };
    }
    try {
        const siteId = await fetchSiteId(accessToken, config.siteUrl);
        const listNames = [config.entriesListName, config.membersListName];
        for (const listName of listNames) {
            try {
                await fetchList(accessToken, siteId, listName);
            } catch (error) {
                if (error instanceof SharePointGraphError) {
                    return { success: false, message: mapErrorToMessage(error.code, { listName }) };
                }
                throw error;
            }
        }
        return { success: true, message: 'Connected.' };
    } catch (error) {
        console.error('Failed to test SharePoint connection', error);
        if (error instanceof SharePointGraphError) {
            return { success: false, message: mapErrorToMessage(error.code) };
        }
        if (error instanceof TypeError) {
            return { success: false, message: mapErrorToMessage('network-error') };
        }
        return { success: false, message: mapErrorToMessage('unknown') };
    }
}

export async function resolveSharePointListUrl(accessToken: string, options?: ResolveListUrlOptions): Promise<{ success: true; url: string } | { success: false; message: string }> {
    const siteUrl = (options?.siteUrl ?? SHAREPOINT_SITE_URL)?.trim();
    const listName = (options?.listName ?? SHAREPOINT_ENTRIES_LIST_NAME)?.trim();

    if (!siteUrl || !listName) {
        return { success: false, message: mapErrorToMessage('missing-config') };
    }

    try {
        const siteId = await fetchSiteId(accessToken, siteUrl);
        const listData = await fetchList(accessToken, siteId, listName, 'webUrl');
        const webUrl = typeof listData?.webUrl === 'string' ? listData.webUrl : null;
        const fallbackUrl = buildListUrl(siteUrl, listName);
        return { success: true, url: webUrl || fallbackUrl };
    } catch (error) {
        console.error('Failed to resolve SharePoint list URL', error);
        if (error instanceof SharePointGraphError) {
            return { success: false, message: mapErrorToMessage(error.code, { listName }) };
        }
        if (error instanceof TypeError) {
            return { success: false, message: mapErrorToMessage('network-error') };
        }
        return { success: false, message: mapErrorToMessage('unknown') };
    }
}
