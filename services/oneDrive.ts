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
