import { SHAREPOINT_ENTRIES_LIST_NAME, SHAREPOINT_MEMBERS_LIST_NAME, SHAREPOINT_SITE_URL, SHAREPOINT_GRAPH_URL } from '../constants';

type ConnectionResult = { success: true; message: string } | { success: false; message: string };

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

    const siteResource = parseSiteResource(SHAREPOINT_SITE_URL);
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

        const listNames = [SHAREPOINT_ENTRIES_LIST_NAME, SHAREPOINT_MEMBERS_LIST_NAME];
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
