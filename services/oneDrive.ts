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

let msalScriptPromise: Promise<void> | null = null;
let clientPromise: Promise<PublicClientApplication | null> | null = null;

function hasMsalGlobal(): boolean {
    return typeof window !== 'undefined' && !!window.msal && typeof window.msal.PublicClientApplication === 'function';
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
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('Failed to load Microsoft authentication library.')), { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = MSAL_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
        script.dataset.msalLoader = 'gmct';
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => reject(new Error('Failed to load Microsoft authentication library.')), { once: true });
        document.head.appendChild(script);
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
