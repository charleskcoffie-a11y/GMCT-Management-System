import { GRAPH_SCOPES, MSAL_CLIENT_ID, MSAL_TENANT_ID } from '../constants';

type AuthorityHint = 'organizations' | 'consumers' | 'common';

type MicrosoftAccount = {
    homeAccountId: string;
    username?: string;
    name?: string;
    tenantId?: string;
};

export type SilentSignInResult = {
    account: MicrosoftAccount;
    accessToken: string;
    authority?: AuthorityHint;
};

type StoredSession = SilentSignInResult & {
    expiresAt: number;
    scopes: string[];
    idToken?: string;
};

type PendingSession = {
    tenant: string;
    nonce: string;
    origin: string;
    createdAt: number;
};

type AuthorizePayload = {
    type?: string;
    state?: string;
    accessToken?: string;
    idToken?: string;
    expiresIn?: string;
    scope?: string;
    tokenType?: string;
    error?: string;
    errorDescription?: string;
    tenant?: string;
};

const STORAGE_KEY = 'gmct-msal-token';
const SESSION_PREFIX = 'gmct-msal:';
const DEFAULT_SCOPES = Array.isArray(GRAPH_SCOPES) && GRAPH_SCOPES.length > 0 ? GRAPH_SCOPES : ['User.Read'];
const CONSUMER_TENANT_ID = '9188040d-6c67-4c5b-b112-36a304b66dad';

class MicrosoftSignInError extends Error {
    retryable: boolean;

    constructor(message: string, retryable = false) {
        super(message);
        this.name = 'MicrosoftSignInError';
        this.retryable = retryable;
    }
}

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function decodeBase64Url(payload: string): string {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    try {
        return window.atob(padded);
    } catch (error) {
        console.warn('Failed to decode base64url token payload.', error);
        return '';
    }
}

function decodeJwt(token?: string | null): Record<string, unknown> | null {
    if (!token) {
        return null;
    }
    const segments = token.split('.');
    if (segments.length < 2) {
        return null;
    }
    const payload = decodeBase64Url(segments[1] ?? '');
    if (!payload) {
        return null;
    }
    try {
        return JSON.parse(payload) as Record<string, unknown>;
    } catch (error) {
        console.warn('Unable to parse JWT payload.', error);
        return null;
    }
}

function createRandomString(length: number): string {
    if (length <= 0) {
        return '';
    }
    if (isBrowser() && window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(length);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => (byte % 36).toString(36)).join('');
    }
    let result = '';
    for (let index = 0; index < length; index += 1) {
        result += Math.floor(Math.random() * 36).toString(36);
    }
    return result;
}

function normalizeTenant(tenant?: string | null): string | null {
    const trimmed = tenant?.trim();
    if (!trimmed) {
        return null;
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/\/$/, '');
    }
    return `https://login.microsoftonline.com/${trimmed}`;
}

function extractAuthorityHint(tenantId?: string | null): AuthorityHint | undefined {
    if (!tenantId) {
        return undefined;
    }
    const lower = tenantId.toLowerCase();
    if (tenantId === CONSUMER_TENANT_ID || lower === 'consumers' || lower.endsWith('/consumers')) {
        return 'consumers';
    }
    if (lower === 'common' || lower.endsWith('/common')) {
        return 'common';
    }
    if (lower === 'organizations' || lower.endsWith('/organizations')) {
        return 'organizations';
    }
    return 'organizations';
}

function determineAuthorityList(): string[] {
    const primary = normalizeTenant(MSAL_TENANT_ID);
    const fallbacks = ['organizations', 'common', 'consumers']
        .map(item => normalizeTenant(item) ?? '')
        .filter(Boolean);
    const candidates = [primary, ...fallbacks].filter((value): value is string => Boolean(value));
    return Array.from(new Set(candidates));
}

function buildAuthorizeUrl(tenantAuthority: string, state: string, nonce: string, scopes: string[]): string {
    const authority = normalizeTenant(tenantAuthority) ?? normalizeTenant('common');
    if (!authority) {
        throw new MicrosoftSignInError('Unable to determine Microsoft login authority.');
    }
    const authorizeUrl = new URL(`${authority}/oauth2/v2.0/authorize`);
    const scopeValue = scopes.join(' ');
    authorizeUrl.searchParams.set('client_id', MSAL_CLIENT_ID ?? '');
    authorizeUrl.searchParams.set('response_type', 'token id_token');
    authorizeUrl.searchParams.set('redirect_uri', `${window.location.origin}/auth-complete.html`);
    authorizeUrl.searchParams.set('response_mode', 'fragment');
    authorizeUrl.searchParams.set('scope', scopeValue);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('nonce', nonce);
    authorizeUrl.searchParams.set('prompt', 'select_account');
    authorizeUrl.searchParams.set('login_hint', '');
    return authorizeUrl.toString();
}

function storePendingSession(state: string, session: PendingSession): void {
    try {
        window.sessionStorage.setItem(`${SESSION_PREFIX}${state}`, JSON.stringify(session));
    } catch (error) {
        console.warn('Unable to persist Microsoft sign-in session data.', error);
    }
}

function readPendingSession(state: string): PendingSession | null {
    try {
        const raw = window.sessionStorage.getItem(`${SESSION_PREFIX}${state}`);
        if (!raw) {
            return null;
        }
        return JSON.parse(raw) as PendingSession;
    } catch (error) {
        console.warn('Unable to read Microsoft sign-in session data.', error);
        return null;
    }
}

function clearPendingSession(state: string): void {
    window.sessionStorage.removeItem(`${SESSION_PREFIX}${state}`);
}

function persistSession(session: StoredSession): void {
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
        console.warn('Unable to persist Microsoft access token.', error);
    }
}

function readStoredSession(): StoredSession | null {
    if (!isBrowser()) {
        return null;
    }
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        return JSON.parse(raw) as StoredSession;
    } catch (error) {
        console.warn('Failed to parse stored Microsoft session.', error);
        window.sessionStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

function removeStoredSession(): void {
    if (!isBrowser()) {
        return;
    }
    window.sessionStorage.removeItem(STORAGE_KEY);
}

function mapAuthorizeError(error?: string | null, description?: string | null): MicrosoftSignInError {
    const details = description ?? '';
    if (error === 'access_denied') {
        if (/AADSTS50020/.test(details) || /AADSTS51004/.test(details)) {
            return new MicrosoftSignInError(
                'Your Microsoft account is not a member of the configured organisation. Sign in with an authorised work or school account.',
                true,
            );
        }
        if (/AADSTS65004/.test(details)) {
            return new MicrosoftSignInError(
                'The Microsoft account lacks required permissions. Ask your administrator to grant the necessary API scopes.',
                false,
            );
        }
        if (/AADSTS50126/.test(details)) {
            return new MicrosoftSignInError(
                'Microsoft reported that the username or password is incorrect. Verify your credentials and try again.',
                false,
            );
        }
        return new MicrosoftSignInError('Access to Microsoft sign-in was denied. Try again or use a different account.', false);
    }
    if (error === 'login_required' || error === 'interaction_required') {
        return new MicrosoftSignInError('Microsoft requires you to sign in interactively.', true);
    }
    if (error === 'invalid_client') {
        return new MicrosoftSignInError('The Microsoft application configuration is invalid. Confirm the client ID and tenant settings.', false);
    }
    if (details) {
        if (/AADSTS50076/.test(details) || /AADSTS50079/.test(details)) {
            return new MicrosoftSignInError('Microsoft requires additional verification (MFA). Complete the prompt and try again.', false);
        }
        if (/AADSTS700016/.test(details)) {
            return new MicrosoftSignInError('The Microsoft application (client ID) could not be found. Confirm the Azure registration details.', false);
        }
    }
    return new MicrosoftSignInError('Sign in failed. Please check your credentials or network connection.', false);
}

function buildAccountFromClaims(claims: Record<string, unknown> | null, fallbackUsername?: string): MicrosoftAccount {
    const preferred =
        (claims?.['preferred_username'] as string | undefined) ??
        (claims?.['email'] as string | undefined) ??
        (claims?.['upn'] as string | undefined) ??
        (claims?.['unique_name'] as string | undefined);
    const username = preferred || fallbackUsername;
    const name = (claims?.['name'] as string | undefined) ?? undefined;
    const tenantId = (claims?.['tid'] as string | undefined) ?? undefined;
    const objectId = (claims?.['oid'] as string | undefined) ?? (claims?.['sub'] as string | undefined);
    const homeAccountId = objectId && tenantId ? `${objectId}.${tenantId}` : objectId || username || createRandomString(12);
    return { homeAccountId, username, name, tenantId };
}

async function performInteractiveLogin(authority: string, scopes: string[]): Promise<SilentSignInResult> {
    if (!isBrowser()) {
        throw new MicrosoftSignInError('Microsoft sign-in is only available in a browser environment.');
    }
    if (!MSAL_CLIENT_ID) {
        throw new MicrosoftSignInError('Microsoft sign-in is not configured. Add a client ID in constants.ts.');
    }

    const state = createRandomString(32);
    const nonce = createRandomString(32);
    const pending: PendingSession = {
        tenant: authority,
        nonce,
        origin: window.location.origin,
        createdAt: Date.now(),
    };
    storePendingSession(state, pending);

    const authorizeUrl = buildAuthorizeUrl(authority, state, nonce, scopes);
    const width = 520;
    const height = 640;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open(
        authorizeUrl,
        'gmct-msal-signin',
        `width=${Math.round(width)},height=${Math.round(height)},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`,
    );

    if (!popup) {
        clearPendingSession(state);
        throw new MicrosoftSignInError('Unable to open the Microsoft sign-in window. Allow pop-ups and try again.');
    }

    return await new Promise<SilentSignInResult>((resolve, reject) => {
        let resolved = false;
        const cleanup = () => {
            resolved = true;
            window.removeEventListener('message', handleMessage);
            window.clearInterval(timer);
            try {
                if (!popup.closed) {
                    popup.close();
                }
            } catch (error) {
                console.warn('Unable to close Microsoft sign-in window.', error);
            }
            clearPendingSession(state);
        };

        const fail = (error: MicrosoftSignInError) => {
            if (!resolved) {
                cleanup();
                reject(error);
            }
        };

        const handleMessage = (event: MessageEvent<AuthorizePayload>) => {
            if (event.origin !== window.location.origin) {
                return;
            }
            const data = event.data;
            if (!data || data.type !== 'gmct-ms-login' || data.state !== state) {
                return;
            }
            const pendingSession = readPendingSession(state);
            if (!pendingSession) {
                fail(new MicrosoftSignInError('The Microsoft sign-in session expired. Please try again.', true));
                return;
            }
            cleanup();

            if (data.error) {
                fail(mapAuthorizeError(data.error, data.errorDescription));
                return;
            }

            if (!data.accessToken) {
                fail(new MicrosoftSignInError('Microsoft did not return an access token. Try signing in again.', true));
                return;
            }

            const claims = decodeJwt(data.idToken);
            if (claims && typeof claims['nonce'] === 'string' && claims['nonce'] !== pendingSession.nonce) {
                fail(new MicrosoftSignInError('Microsoft sign-in verification failed. Please try again.', true));
                return;
            }

            const fallbackUsername = (claims?.['email'] as string | undefined) ?? undefined;
            const account = buildAccountFromClaims(claims, fallbackUsername);
            const tenantId = account.tenantId ?? pendingSession.tenant;
            const authorityHint = extractAuthorityHint(tenantId);
            const expiresInSeconds = Number.parseInt(data.expiresIn ?? '0', 10) || 3600;
            const expiresAt = Date.now() + Math.max(expiresInSeconds - 60, 0) * 1000;
            const scopesFromToken = (data.scope ?? '').split(' ').filter(Boolean);

            const stored: StoredSession = {
                account,
                accessToken: data.accessToken,
                authority: authorityHint,
                expiresAt,
                scopes: scopesFromToken.length > 0 ? scopesFromToken : scopes,
                idToken: data.idToken,
            };
            persistSession(stored);
            resolve({ account, accessToken: data.accessToken, authority: authorityHint });
        };

        window.addEventListener('message', handleMessage);

        const timer = window.setInterval(() => {
            if (popup.closed) {
                window.clearInterval(timer);
                fail(new MicrosoftSignInError('The Microsoft sign-in window was closed before completion.', false));
            }
        }, 500);
    });
}

export async function msalInteractiveSignIn(): Promise<SilentSignInResult> {
    if (!isBrowser()) {
        throw new MicrosoftSignInError('Microsoft sign-in is only available in the browser.');
    }

    const scopes = DEFAULT_SCOPES;
    const authorities = determineAuthorityList();
    let lastError: MicrosoftSignInError | null = null;

    for (const authority of authorities) {
        try {
            return await performInteractiveLogin(authority, scopes);
        } catch (error) {
            if (error instanceof MicrosoftSignInError) {
                lastError = error;
                if (error.retryable) {
                    continue;
                }
                throw error;
            }
            lastError = new MicrosoftSignInError('Unexpected error during Microsoft sign-in.');
        }
    }

    if (lastError) {
        throw lastError;
    }

    throw new MicrosoftSignInError('Microsoft sign-in could not be completed.');
}

export async function msalSilentSignIn(): Promise<SilentSignInResult | null> {
    const stored = readStoredSession();
    if (!stored) {
        return null;
    }
    if (Date.now() >= stored.expiresAt) {
        removeStoredSession();
        return null;
    }
    return {
        account: stored.account,
        accessToken: stored.accessToken,
        authority: stored.authority,
    };
}

export function clearStoredMicrosoftSession(): void {
    removeStoredSession();
}

