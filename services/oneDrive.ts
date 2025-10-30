import { MSAL_CLIENT_ID, MSAL_TENANT_ID, GRAPH_SCOPES } from '../constants';

type SilentSignInResult = {
    account: { homeAccountId: string; username?: string };
    accessToken: string;
};

/**
 * Placeholder silent sign-in flow. In production you would wire this to MSAL.
 * For local development we simply resolve to null so the UI knows manual sign-in is required.
 */
export async function msalSilentSignIn(): Promise<SilentSignInResult | null> {
    if (!MSAL_CLIENT_ID || !MSAL_TENANT_ID) {
        console.warn('MSAL configuration missing client or tenant id.');
        return null;
    }

    try {
        const cached = window.sessionStorage.getItem('gmct-msal-token');
        if (!cached) {
            return null;
        }
        const parsed = JSON.parse(cached) as SilentSignInResult & { scopes?: string[] };
        if (parsed.scopes && GRAPH_SCOPES.every(scope => parsed.scopes?.includes(scope))) {
            return { account: parsed.account, accessToken: parsed.accessToken };
        }
        return null;
    } catch (error) {
        console.warn('Failed to perform silent sign-in, falling back to manual flow.', error);
        return null;
    }
}

export async function cacheSilentSignIn(result: SilentSignInResult): Promise<void> {
    try {
        window.sessionStorage.setItem('gmct-msal-token', JSON.stringify({ ...result, scopes: GRAPH_SCOPES }));
    } catch (error) {
        console.warn('Unable to persist silent sign-in cache.', error);
    }
}

export async function interactiveMsalSignIn(): Promise<SilentSignInResult> {
    const redirectUri = window.location.origin;
    const scopes = encodeURIComponent(GRAPH_SCOPES.join(' '));
    const tenant = MSAL_TENANT_ID || 'common';
    const clientId = MSAL_CLIENT_ID;
    const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_mode=fragment`;

    window.open(authUrl, '_blank', 'noopener');

    const fallbackResult: SilentSignInResult = {
        account: { homeAccountId: 'manual-sign-in', username: 'manual@microsoft.com' },
        accessToken: `manual-token-${Date.now()}`,
    };

    await cacheSilentSignIn(fallbackResult);
    return fallbackResult;
}
