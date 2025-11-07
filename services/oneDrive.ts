import { MSAL_CLIENT_ID, MSAL_TENANT_ID, GRAPH_SCOPES, MICROSOFT_ALLOWED_EMAIL_DOMAINS } from '../constants';

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

export async function msalInteractiveSignIn(): Promise<SilentSignInResult> {
    if (typeof window === 'undefined') {
        throw new Error('Sign in is only available in the browser.');
    }

    return new Promise((resolve, reject) => {
        const width = 480;
        const height = 640;
        const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
        const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
        const features = `width=${Math.round(width)},height=${Math.round(height)},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`;
        const popup = window.open('', 'gmct-msal-signin', features);
        if (!popup) {
            reject(new Error('Unable to open sign-in window. Please allow pop-ups and try again.'));
            return;
        }

        popup.document.title = 'Microsoft Sign-In';

        const cleanup = () => {
            window.removeEventListener('message', handleMessage);
            window.clearInterval(timer);
        };

        const handleMessage = (event: MessageEvent) => {
            if (event.source !== popup) {
                return;
            }

            const data = event.data as { type?: string; status?: string; email?: string; message?: string } | null;
            if (!data || data.type !== 'gmct-msal-signin') {
                return;
            }

            cleanup();

            if (data.status !== 'success' || !data.email) {
                reject(new Error(data?.message || 'Sign in failed. Please check your credentials or network connection.'));
                popup.close();
                return;
            }

            const createAccountId = (): string => {
                try {
                    if (typeof window.crypto !== 'undefined' && typeof window.crypto.randomUUID === 'function') {
                        return window.crypto.randomUUID();
                    }
                } catch (error) {
                    console.warn('Unable to generate random UUID for account id.', error);
                }
                return `mock-${Date.now()}`;
            };

            const accessToken = btoa(`${data.email}:${Date.now()}`);
            const result: SilentSignInResult = {
                account: { homeAccountId: createAccountId(), username: data.email },
                accessToken,
            };
            void cacheSilentSignIn(result);
            popup.close();
            resolve(result);
        };

        window.addEventListener('message', handleMessage);

        const timer = window.setInterval(() => {
            if (popup.closed) {
                cleanup();
                reject(new Error('Sign in failed. Please check your credentials or network connection.'));
            }
        }, 500);

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
            const allowedDomains = ${JSON.stringify(MICROSOFT_ALLOWED_EMAIL_DOMAINS)};
            const allowedDomainsLower = Array.isArray(allowedDomains)
                ? allowedDomains
                    .map(function(entry) { return String(entry || '').toLowerCase().trim(); })
                    .filter(function(entry) { return entry.length > 0; })
                : [];

            function normaliseEmail(value) {
                return String(value || '').trim();
            }

            function getDomain(value) {
                if (!value) {
                    return false;
                }
                const atIndex = value.lastIndexOf('@');
                if (atIndex < 1 || atIndex === value.length - 1) {
                    return false;
                }
                return value.slice(atIndex + 1).toLowerCase();
            }

            function isEmailAllowed(email) {
                const domain = getDomain(email);
                if (!domain) {
                    return false;
                }
                if (!allowedDomainsLower.length || allowedDomainsLower.includes('*')) {
                    return true;
                }
                return allowedDomainsLower.some(function(allowed) {
                    return domain === allowed || domain.endsWith('.' + allowed);
                });
            }

            function send(status, payload) {
                if (window.opener && !window.opener.closed) {
                    window.opener.postMessage(Object.assign({ type: 'gmct-msal-signin', status }, payload || {}), '*');
                }
            }

            cancelBtn.addEventListener('click', function() {
                send('error', { message: 'Sign in cancelled.' });
                window.close();
            });

            form.addEventListener('submit', function(event) {
                event.preventDefault();
                const sanitisedEmail = normaliseEmail(emailInput.value);
                const email = sanitisedEmail.toLowerCase();
                const password = String(passwordInput.value || '');
                const humanAllowed = allowedDomainsLower.length && !allowedDomainsLower.includes('*')
                    ? allowedDomainsLower.map(function(entry) { return '@' + entry; }).join(', ')
                    : '';

                if (!isEmailAllowed(email)) {
                    const domainHint = humanAllowed ? ' Use a work or school account such as ' + humanAllowed + '.' : '';
                    messageEl.textContent = 'Enter a valid Microsoft 365 work or school email address.' + domainHint;
                    messageEl.className = 'message error';
                    return;
                }

                if (!password) {
                    messageEl.textContent = 'Password is required.';
                    messageEl.className = 'message error';
                    return;
                }

                messageEl.textContent = 'Signing in to your Microsoft 365 account…';
                messageEl.className = 'message info';

                setTimeout(function() {
                    send('success', { email: sanitisedEmail });
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

export async function cacheSilentSignIn(result: SilentSignInResult): Promise<void> {
    try {
        window.sessionStorage.setItem('gmct-msal-token', JSON.stringify({ ...result, scopes: GRAPH_SCOPES }));
    } catch (error) {
        console.warn('Unable to persist silent sign-in cache.', error);
    }
}
