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

export class MicrosoftSignInError extends Error {
    retryable: boolean;

    constructor(message: string, retryable = false) {
        super(message);
        this.name = 'MicrosoftSignInError';
        this.retryable = retryable;
    }
}

type PendingSession = {
    tenant: string;
    nonce: string;
    origin: string;
    createdAt: number;
    scopes: string[];
};

type StoredSession = SilentSignInResult & {
    expiresAt: number;
    scopes: string[];
};

type AuthorizePayload = {
    type?: string;
    state?: string | null;
    accessToken?: string | null;
    idToken?: string | null;
    expiresIn?: string | null;
    scope?: string | null;
    error?: string | null;
    errorDescription?: string | null;
    tenant?: string | null;
};

const SESSION_PREFIX = 'gmct-msal:';
const STORAGE_KEY = 'gmct-msal-session';
const PENDING_SESSION_MAX_AGE = 5 * 60 * 1000;
const CONSUMER_TENANT_ID = '9188040d-6c67-4c5b-b112-36a304b66dad';
const DEFAULT_SCOPES = Array.from(new Set([...GRAPH_SCOPES, 'openid', 'profile', 'email']));

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.document !== 'undefined';
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
    if (!tenant) {
        return null;
    }
    const trimmed = tenant.trim();
    if (!trimmed) {
        return null;
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/\/$/, '');
    }
    return `https://login.microsoftonline.com/${trimmed}`;
}

function determineAuthorityList(): string[] {
    const values = [MSAL_TENANT_ID, 'organizations', 'common', 'consumers']
        .map(value => normalizeTenant(value) ?? null)
        .filter((value): value is string => Boolean(value));
    return Array.from(new Set(values));
}

function buildAuthorizeUrl(authority: string, state: string, nonce: string, scopes: string[]): string {
    const normalizedAuthority = normalizeTenant(authority);
    if (!normalizedAuthority) {
        throw new MicrosoftSignInError('Unable to determine Microsoft login authority.');
    }
    const authorizeUrl = new URL(`${normalizedAuthority}/oauth2/v2.0/authorize`);
    authorizeUrl.searchParams.set('client_id', MSAL_CLIENT_ID ?? '');
    authorizeUrl.searchParams.set('response_type', 'token id_token');
    authorizeUrl.searchParams.set('redirect_uri', `${window.location.origin}/auth-complete.html`);
    authorizeUrl.searchParams.set('response_mode', 'fragment');
    authorizeUrl.searchParams.set('scope', scopes.join(' '));
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('nonce', nonce);
    authorizeUrl.searchParams.set('prompt', 'select_account');
    return authorizeUrl.toString();
}

function storePendingSession(state: string, session: PendingSession): void {
    if (!isBrowser()) {
        return;
    }
    try {
        window.sessionStorage.setItem(`${SESSION_PREFIX}${state}`, JSON.stringify(session));
    } catch (error) {
        console.warn('Unable to persist Microsoft sign-in session data.', error);
    }
}

function readPendingSession(state: string): PendingSession | null {
    if (!isBrowser()) {
        return null;
    }
    try {
        const raw = window.sessionStorage.getItem(`${SESSION_PREFIX}${state}`);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as PendingSession;
        if (!parsed || typeof parsed.createdAt !== 'number') {
            window.sessionStorage.removeItem(`${SESSION_PREFIX}${state}`);
            return null;
        }
        if (Date.now() - parsed.createdAt > PENDING_SESSION_MAX_AGE) {
            window.sessionStorage.removeItem(`${SESSION_PREFIX}${state}`);
            return null;
        }
        return parsed;
    } catch (error) {
        console.warn('Unable to parse pending Microsoft sign-in session.', error);
        window.sessionStorage.removeItem(`${SESSION_PREFIX}${state}`);
        return null;
    }
}

function clearPendingSession(state: string): void {
    if (!isBrowser()) {
        return;
    }
    window.sessionStorage.removeItem(`${SESSION_PREFIX}${state}`);
}

function persistSession(session: StoredSession): void {
    if (!isBrowser()) {
        return;
    }
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
        console.warn('Unable to store Microsoft session.', error);
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
        const parsed = JSON.parse(raw) as StoredSession;
        if (!parsed || typeof parsed.expiresAt !== 'number' || typeof parsed.accessToken !== 'string') {
            window.sessionStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return parsed;
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

function safeBase64Decode(input: string): string {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof globalThis.atob === 'function') {
        return globalThis.atob(normalized);
    }
    throw new Error('Base64 decoding is not supported in this environment.');
}

function decodeJwt(token?: string | null): Record<string, unknown> | null {
    if (!token) {
        return null;
    }
    const parts = token.split('.');
    if (parts.length < 2) {
        return null;
    }
    try {
        const decoded = safeBase64Decode(parts[1]);
        const json = decodeURIComponent(
            Array.from(decoded)
                .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
                .join(''),
        );
        return JSON.parse(json) as Record<string, unknown>;
    } catch (error) {
        console.warn('Unable to parse JWT payload.', error);
        return null;
    }
}

function extractAuthorityHint(tenant?: string | null): AuthorityHint | undefined {
    if (!tenant) {
        return undefined;
    }
    const normalized = tenant.toLowerCase();
    if (normalized === 'consumers' || normalized.endsWith('/consumers') || normalized === CONSUMER_TENANT_ID) {
        return 'consumers';
    }
    if (normalized === 'common' || normalized.endsWith('/common')) {
        return 'common';
    }
    if (normalized === 'organizations' || normalized.endsWith('/organizations')) {
        return 'organizations';
    }
    if (normalized.endsWith('.onmicrosoft.com') || /^[0-9a-f-]{36}$/.test(normalized)) {
        return 'organizations';
    }
    return undefined;
}

function buildAccountFromClaims(claims: Record<string, unknown> | null): MicrosoftAccount {
    const preferred =
        (claims?.['preferred_username'] as string | undefined) ??
        (claims?.['upn'] as string | undefined) ??
        (claims?.['email'] as string | undefined) ??
        (claims?.['unique_name'] as string | undefined);
    const name = (claims?.['name'] as string | undefined) ?? undefined;
    const tenantId = (claims?.['tid'] as string | undefined) ?? undefined;
    const objectId = (claims?.['oid'] as string | undefined) ?? (claims?.['sub'] as string | undefined);
    const homeAccountId = objectId && tenantId ? `${objectId}.${tenantId}` : objectId || preferred || createRandomString(12);
    return {
        homeAccountId,
        username: preferred,
        name,
        tenantId,
    };
}

function mapAuthorizeError(error?: string | null, description?: string | null): MicrosoftSignInError {
    const details = description ?? '';
    if (error === 'access_denied') {
        if (/AADSTS50020/.test(details) || /AADSTS51004/.test(details)) {
            return new MicrosoftSignInError(
                'Your Microsoft account is not a member of the configured organisation. Sign in with an authorised work or school account.',
                false,
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
            return new MicrosoftSignInError('Microsoft requires additional verification (MFA). Complete the prompt and try again.', true);
        }
        if (/AADSTS700016/.test(details)) {
            return new MicrosoftSignInError('The Microsoft application (client ID) could not be found. Confirm the Azure registration details.', false);
        }
    }
    return new MicrosoftSignInError('Sign in failed. Please check your credentials or network connection.', false);
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
        scopes,
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
        let settled = false;

        const cleanup = () => {
            settled = true;
            window.removeEventListener('message', handleMessage as EventListener);
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
            if (!settled) {
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
            cleanup();

            if (!pendingSession) {
                fail(new MicrosoftSignInError('The Microsoft sign-in session expired. Please try again.', true));
                return;
            }

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

            const account = buildAccountFromClaims(claims);
            const tenantId = account.tenantId ?? pendingSession.tenant ?? data.tenant ?? undefined;
            const authorityHint = extractAuthorityHint(typeof tenantId === 'string' ? tenantId : undefined);
            const expiresInSeconds = Number.parseInt(data.expiresIn ?? '0', 10);
            const expiresIn = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 3600;
            const expiresAt = Date.now() + Math.max(expiresIn - 60, 300) * 1000;
            const scopesFromToken = typeof data.scope === 'string' ? data.scope.split(' ').filter(Boolean) : [];

            const stored: StoredSession = {
                account,
                accessToken: data.accessToken,
                authority: authorityHint,
                expiresAt,
                scopes: scopesFromToken.length > 0 ? scopesFromToken : pendingSession.scopes,
            };
            persistSession(stored);
            resolve({ account, accessToken: data.accessToken, authority: authorityHint });
        };

        window.addEventListener('message', handleMessage as EventListener);

        const timer = window.setInterval(() => {
            if (popup.closed) {
                window.clearInterval(timer);
                fail(new MicrosoftSignInError('The Microsoft sign-in window was closed before completion.', false));
            }
        }, 500);
    });
}

export async function msalInteractiveSignIn(): Promise<SilentSignInResult> {
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

    throw lastError ?? new MicrosoftSignInError('Microsoft sign-in could not be completed.');
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
    if (GRAPH_SCOPES.some(scope => !stored.scopes.includes(scope))) {
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
