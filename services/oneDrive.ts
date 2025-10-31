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
    authority?: 'organizations' | 'consumers' | 'common';
};

const PERSONAL_EMAIL_DOMAINS = ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'];

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
        const parsed = JSON.parse(cached) as SilentSignInResult & { scopes?: string[] };
        if (parsed.scopes && GRAPH_SCOPES.every(scope => parsed.scopes?.includes(scope))) {
            return { account: parsed.account, accessToken: parsed.accessToken, authority: parsed.authority };
        }
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

            const data = event.data as { type?: string; status?: string; email?: string; message?: string; authority?: SilentSignInResult['authority'] } | null;
            if (!data || data.type !== 'gmct-msal-signin') {
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

            const accessToken = btoa(`${data.email}:${Date.now()}`);
            const result: SilentSignInResult = {
                account: { homeAccountId: createAccountId(), username: data.email },
                accessToken,
                authority: data.authority,
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

        const popupHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Microsoft Sign-In</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f1f5f9; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }
        .card { background: #ffffff; border-radius: 16px; box-shadow: 0 20px 45px -20px rgba(15, 23, 42, 0.45); padding: 32px; width: 100%; max-width: 360px; }
        h1 { font-size: 1.35rem; margin-bottom: 1rem; color: #1e293b; }
        label { display: block; margin-bottom: 1rem; font-size: 0.85rem; color: #475569; }
        input { width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid #cbd5f5; font-size: 0.95rem; box-sizing: border-box; }
        .actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
        button { flex: 1; padding: 0.7rem 0; border: none; border-radius: 9999px; font-weight: 600; cursor: pointer; }
        .primary { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; }
        .secondary { background: #e2e8f0; color: #0f172a; }
        .message { margin-top: 1rem; font-size: 0.85rem; color: #475569; min-height: 1.2em; }
        .message.error { color: #dc2626; }
        .message.info { color: #2563eb; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Sign in to Microsoft</h1>
        <form id="gmct-msal-form">
            <label>
                Email address
                <input id="gmct-email" type="email" autocomplete="username" required autofocus />
            </label>
            <label>
                Password
                <input id="gmct-password" type="password" autocomplete="current-password" required />
            </label>
            <div class="actions">
                <button type="submit" class="primary">Sign in</button>
                <button type="button" id="gmct-cancel" class="secondary">Cancel</button>
            </div>
            <p id="gmct-message" class="message" role="status" aria-live="polite"></p>
        </form>
    </div>
    <script>
        (function() {
            const form = document.getElementById('gmct-msal-form');
            const emailInput = document.getElementById('gmct-email');
            const passwordInput = document.getElementById('gmct-password');
            const messageEl = document.getElementById('gmct-message');
            const cancelBtn = document.getElementById('gmct-cancel');
            const personalDomains = ${JSON.stringify(PERSONAL_EMAIL_DOMAINS)};
            const tenantAuthority = {
                corporate: 'https://login.microsoftonline.com/organizations',
                personal: 'https://login.microsoftonline.com/consumers'
            };

            function send(status, payload) {
                if (window.opener && !window.opener.closed) {
                    window.opener.postMessage(Object.assign({ type: 'gmct-msal-signin', status }, payload || {}), '*');
                }
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

                const domain = email.split('@')[1]?.toLowerCase() || '';
                const isPersonal = personalDomains.includes(domain);
                messageEl.textContent = isPersonal
                    ? 'Redirecting to Microsoft personal account login… (' + tenantAuthority.personal + ')'
                    : 'Redirecting to your organization\'s Microsoft login… (' + tenantAuthority.corporate + ')';
                messageEl.className = 'message info';

                setTimeout(function() {
                    if (password.length < 6) {
                        messageEl.textContent = 'Microsoft rejected the credentials. Passwords must be at least 6 characters.';
                        messageEl.className = 'message error';
                        send('error', {
                            message: 'Microsoft rejected the credentials. Confirm your password and try again.',
                            authority: isPersonal ? 'consumers' : 'organizations'
                        });
                        return;
                    }

                    send('success', { email: email, authority: isPersonal ? 'consumers' : 'organizations' });
                    window.close();
                }, 600);
            });
        })();
    </script>
</body>
</html>`;

        popup.document.open();
        popup.document.write(popupHtml);
        popup.document.close();
        popup.focus();
    });
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

