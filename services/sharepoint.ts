import { SHAREPOINT_ENTRIES_LIST_NAME, SHAREPOINT_MEMBERS_LIST_NAME, SHAREPOINT_SITE_URL, SHAREPOINT_GRAPH_URL } from '../constants';
import type { Entry, Member } from '../types';

type ConnectionResult = { success: true; message: string } | { success: false; message: string };

type SharePointConnectionOptions = {
    siteUrl?: string | null;
    listNames?: Array<string | null | undefined>;
};

type GraphError = 'not-signed-in' | 'missing-config' | 'site-missing' | 'list-missing' | 'network-error' | 'unknown';

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
            return 'Access denied. Sign in with a Microsoft account that has permission.';
        case 'missing-config':
            return 'SharePoint connection is missing required settings.';
        case 'list-missing':
            return context?.listName ? `The list "${context.listName}" is missing.` : 'The list is missing.';
        case 'site-missing':
            return 'The SharePoint site could not be found.';
        case 'network-error':
            return 'Network unavailable. Check your connection and try again.';
        default:
            return 'Unable to confirm the SharePoint connection right now.';
    }
}

function logMissingConfig(action: string): void {
    console.warn(`SharePoint configuration is incomplete. Skipping ${action}.`);
}

export function resetContextCache(): void {
    // This implementation keeps no runtime cache yet, but the function exists for API parity.
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

export async function testSharePointConnection(accessToken?: string | null, options?: SharePointConnectionOptions): Promise<ConnectionResult> {
    if (!accessToken) {
        return { success: false, message: mapErrorToMessage('not-signed-in') };
    }

    const siteUrl = options?.siteUrl?.trim() || SHAREPOINT_SITE_URL;
    const configuredListNames = options?.listNames?.map(name => name?.trim()).filter((name): name is string => Boolean(name));
    const listNames = configuredListNames && configuredListNames.length > 0
        ? configuredListNames
        : [SHAREPOINT_ENTRIES_LIST_NAME, SHAREPOINT_MEMBERS_LIST_NAME].filter((name): name is string => Boolean(name));

    if (!siteUrl || listNames.length === 0) {
        return { success: false, message: mapErrorToMessage('missing-config') };
    }

    const siteResource = parseSiteResource(siteUrl);
    if (!siteResource) {
        return { success: false, message: mapErrorToMessage('missing-config') };
    }

    try {
        const siteResponse = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteResource}?$select=id`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
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

        for (const listName of listNames) {
            const listResponse = await fetch(`${SHAREPOINT_GRAPH_URL}/sites/${siteId}/lists/${encodeURIComponent(listName)}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
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
