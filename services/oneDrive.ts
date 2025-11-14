import { MSAL_CLIENT_ID, MSAL_TENANT_ID, GRAPH_SCOPES, MICROSOFT_ALLOWED_EMAIL_DOMAINS } from '../constants';

type AccountInfo = {
    homeAccountId: string;
    localAccountId?: string;
    username?: string;
    environment?: string;
    tenantId?: string;
    [key: string]: unknown;
};

type AuthenticationResult = {
    accessToken: string;
    account: AccountInfo | null;
};

type PopupRequest = {
    scopes?: string[];
    prompt?: 'select_account' | 'login' | 'consent';
};

type SilentRequest = {
    scopes?: string[];
    account: AccountInfo;
};

type LogoutRequest = {
    account?: AccountInfo;
    postLogoutRedirectUri?: string;
};

type CacheLocation = 'localStorage' | 'sessionStorage';

type PublicClientConfiguration = {
    auth: {
        clientId: string;
        authority?: string;
        redirectUri?: string;
        knownAuthorities?: string[];
    };
    cache?: {
        cacheLocation?: CacheLocation;
        storeAuthStateInCookie?: boolean;
    };
};

interface PublicClientApplication {
    initialize(): Promise<void>;
    getAllAccounts(): AccountInfo[];
    loginPopup(request: PopupRequest): Promise<AuthenticationResult>;
    acquireTokenSilent(request: SilentRequest): Promise<AuthenticationResult>;
    logoutPopup(request: LogoutRequest): Promise<void>;
}

interface MsalModule {
    PublicClientApplication: new (config: PublicClientConfiguration) => PublicClientApplication;
}

declare global {
    interface Window {
        msal?: MsalModule;
    }
}

export type SilentSignInResult = {
    account: AccountInfo;
    accessToken: string;
};

const allowedDomains = new Set(
    (MICROSOFT_ALLOWED_EMAIL_DOMAINS ?? [])
        .map(domain => (domain ?? '').trim().toLowerCase())
        .filter(Boolean),
);

const isBrowserEnvironment = () => typeof window !== 'undefined';

const getAuthority = () => `https://login.microsoftonline.com/${MSAL_TENANT_ID}`;

const MSAL_SCRIPT_URL = 'https://alcdn.msauth.net/browser/2.40.0/js/msal-browser.min.js';
const MSAL_GLOBAL_TIMEOUT_MS = 15_000;
const MSAL_GLOBAL_POLL_INTERVAL_MS = 50;

let msalScriptPromise: Promise<void> | null = null;
let clientPromise: Promise<PublicClientApplication | null> | null = null;

function hasMsalGlobal(): boolean {
    return typeof window !== 'undefined' && !!window.msal && typeof window.msal.PublicClientApplication === 'function';
}

function waitForMsalGlobal(): Promise<void> {
    if (!isBrowserEnvironment()) {
        return Promise.reject(new Error('Microsoft authentication requires a browser environment.'));
    }
    if (hasMsalGlobal()) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + MSAL_GLOBAL_TIMEOUT_MS;
        const intervalId = window.setInterval(() => {
            if (hasMsalGlobal()) {
                window.clearInterval(intervalId);
                resolve();
                return;
            }
            if (Date.now() >= deadline) {
                window.clearInterval(intervalId);
                reject(new Error('Microsoft authentication library failed to initialise within the expected time.'));
            }
        }, MSAL_GLOBAL_POLL_INTERVAL_MS);
    });
}

async function loadMsalLibrary(): Promise<void> {
    if (!isBrowserEnvironment()) {
        throw new Error('Microsoft authentication requires a browser environment.');
    }
    if (hasMsalGlobal()) {
        return;
    }
    if (msalScriptPromise) {
        return msalScriptPromise;
    }
    msalScriptPromise = new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>('script[data-msal-loader="gmct"]');
        const script = existingScript ?? document.createElement('script');

        const settleWhenReady = () => {
            waitForMsalGlobal()
                .then(() => {
                    cleanup();
                    resolve();
                })
                .catch(error => {
                    cleanup();
                    reject(error);
                });
        };

        const cleanup = () => {
            script.removeEventListener('load', handleLoad);
            script.removeEventListener('error', handleError);
        };

        const handleLoad = () => {
            settleWhenReady();
        };

        const handleError = () => {
            cleanup();
            reject(new Error('Failed to load Microsoft authentication library.'));
        };

        script.addEventListener('load', handleLoad, { once: true });
        script.addEventListener('error', handleError, { once: true });

        if (existingScript) {
            const state = (existingScript as HTMLScriptElement & { readyState?: string }).readyState;
            if (state === 'complete' || state === 'loaded') {
                cleanup();
                settleWhenReady();
                return;
            }
            // In some browsers readyState is undefined for statically declared scripts even
            // after they have executed. To avoid leaving callers stuck waiting for the load
            // event (which already fired), fall back to polling for the global immediately.
            window.setTimeout(settleWhenReady, 0);
            return;
        }

        script.src = MSAL_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
        script.dataset.msalLoader = 'gmct';

        const target = document.head || document.getElementsByTagName('head')[0] || document.body || document.documentElement;
        if (!target) {
            cleanup();
            reject(new Error('Unable to attach Microsoft authentication script to the document.'));
            return;
        }

        target.appendChild(script);
    }).catch(error => {
        msalScriptPromise = null;
        throw error;
    });
    return msalScriptPromise;
}

function getMsalModule(): MsalModule | null {
    if (!hasMsalGlobal()) {
        return null;
    }
    return window.msal!;
}

async function ensureMsalClient(): Promise<PublicClientApplication | null> {
    if (clientPromise) {
        return clientPromise;
    }
    if (!isBrowserEnvironment()) {
        return null;
    }
    if (!MSAL_CLIENT_ID || !MSAL_TENANT_ID) {
        console.warn('MSAL configuration missing client or tenant id.');
        return null;
    }
    try {
        await loadMsalLibrary();
    } catch (error) {
        console.error('Microsoft authentication library failed to load', error);
        return null;
    }
    const module = getMsalModule();
    if (!module) {
        console.warn('Microsoft authentication library is not available on window.');
        return null;
    }
    const instance = new module.PublicClientApplication({
        auth: {
            clientId: MSAL_CLIENT_ID,
            authority: getAuthority(),
            redirectUri: window.location.origin,
        },
        cache: {
            cacheLocation: 'sessionStorage',
            storeAuthStateInCookie: true,
        },
    });
    clientPromise = instance.initialize().then(() => instance).catch(error => {
        console.error('Failed to initialise MSAL client', error);
        clientPromise = null;
        return null;
    });
    return clientPromise;
}

function extractDomain(username?: string): string | null {
    if (!username) {
        return null;
    }
    const trimmed = username.trim().toLowerCase();
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex === -1 || atIndex === trimmed.length - 1) {
        return null;
    }
    return trimmed.slice(atIndex + 1);
}

function isAccountAllowed(account: AccountInfo | null | undefined): account is AccountInfo {
    if (!account) {
        return false;
    }
    if (!allowedDomains.size) {
        return true;
    }
    const domain = extractDomain(account.username);
    return !!domain && allowedDomains.has(domain);
}

async function acquireTokenForAccount(
    client: PublicClientApplication,
    account: AccountInfo,
): Promise<SilentSignInResult | null> {
    try {
        const result = await client.acquireTokenSilent({
            scopes: GRAPH_SCOPES,
            account,
        });
        if (!result.accessToken) {
            return null;
        }
        return { account: (result.account ?? account) as AccountInfo, accessToken: result.accessToken };
    } catch (error) {
        const needsInteraction = typeof error === 'object' && error !== null && 'errorCode' in error &&
            (error as { errorCode?: string }).errorCode === 'interaction_required';
        if (needsInteraction) {
            return null;
        }
        console.warn('Silent token acquisition failed', error);
        return null;
    }
}

export async function msalSilentSignIn(): Promise<SilentSignInResult | null> {
    const client = await ensureMsalClient();
    if (!client) {
        return null;
    }
    const accounts = client.getAllAccounts();
    for (const account of accounts) {
        if (!isAccountAllowed(account)) {
            continue;
        }
        const result = await acquireTokenForAccount(client, account);
        if (result) {
            return result;
        }
    }
    return null;
}

function assertClient(client: PublicClientApplication | null): asserts client is PublicClientApplication {
    if (!client) {
        throw new Error('Microsoft authentication is unavailable. Refresh the page or contact your administrator.');
    }
}

function assertAllowedAccount(account: AccountInfo | null | undefined): asserts account is AccountInfo {
    if (!isAccountAllowed(account ?? null)) {
        throw new Error('Please sign in with an approved Microsoft work or school account.');
    }
}

export async function msalInteractiveSignIn(): Promise<SilentSignInResult> {
    if (!isBrowserEnvironment()) {
        throw new Error('Sign in is only available in the browser.');
    }
    const client = await ensureMsalClient();
    assertClient(client);
    try {
        const loginResult = await client.loginPopup({
            scopes: GRAPH_SCOPES,
            prompt: 'select_account',
        });
        assertAllowedAccount(loginResult.account);
        const tokenResult = await client.acquireTokenSilent({
            scopes: GRAPH_SCOPES,
            account: loginResult.account!,
        });
        if (!tokenResult.accessToken) {
            throw new Error('Microsoft did not return an access token. Please try again.');
        }
        return {
            account: (tokenResult.account ?? loginResult.account) as AccountInfo,
            accessToken: tokenResult.accessToken,
        };
    } catch (error) {
        console.error('Microsoft interactive sign-in failed', error);
        const message = error instanceof Error && error.message
            ? error.message
            : 'Sign in failed. Please check your credentials or network connection.';
        throw new Error(message);
    }
}
