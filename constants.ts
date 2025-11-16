// constants.ts

// --- Application Metadata ---
export const APP_VERSION = '0.0.0';

// --- MSAL / OneDrive Configuration ---
// IMPORTANT: Replace with your actual Azure App Registration Client ID
export const MSAL_CLIENT_ID = "c8358699-db35-45ca-997d-dc15c2be9553";
// IMPORTANT: To fix sign-in errors for single-tenant apps, replace this with your Azure Tenant ID.
// You can find this on the Overview page of your Azure Active Directory.
// e.g., "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" or "yourtenant.onmicrosoft.com"
export const MSAL_TENANT_ID = "10eb45a8-7562-4898-a5a5-8cc3598fd239";
export const GRAPH_SCOPES = ["User.Read", "Files.ReadWrite.AppFolder", "Sites.ReadWrite.All"];
// Corporate domains that are allowed to complete the in-app Microsoft 365 sign-in helper.
// Update this list to match the work or school accounts for your organisation.
export const MICROSOFT_ALLOWED_EMAIL_DOMAINS = [
    'gmct-ca.org',
    'gmct98.onmicrosoft.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
];

type EnvRecord = Record<string, string | undefined>;

const resolveEnvValue = (key: string, fallback = ''): string => {
    const metaEnv: EnvRecord | undefined = typeof import.meta !== 'undefined'
        ? (import.meta as { env?: EnvRecord }).env
        : undefined;
    if (metaEnv && metaEnv[key] !== undefined) {
        return metaEnv[key] ?? fallback;
    }
    const nodeEnv = typeof process !== 'undefined' && typeof process.env !== 'undefined'
        ? (process.env as EnvRecord)
        : undefined;
    if (nodeEnv && nodeEnv[key] !== undefined) {
        return nodeEnv[key] ?? fallback;
    }
    return fallback;
};

// --- Supabase Configuration Defaults ---
export const DEFAULT_SUPABASE_URL = resolveEnvValue('VITE_SUPABASE_URL', '');
export const DEFAULT_SUPABASE_ANON_KEY = resolveEnvValue('VITE_SUPABASE_ANON_KEY', '');
export const DEFAULT_SUPABASE_ENTRIES_TABLE = resolveEnvValue('VITE_SUPABASE_ENTRIES_TABLE', 'entries');
export const DEFAULT_SUPABASE_MEMBERS_TABLE = resolveEnvValue('VITE_SUPABASE_MEMBERS_TABLE', 'members');
export const DEFAULT_SUPABASE_HISTORY_TABLE = resolveEnvValue('VITE_SUPABASE_HISTORY_TABLE', 'weekly_history');
export const DEFAULT_SUPABASE_TASKS_TABLE = resolveEnvValue('VITE_SUPABASE_TASKS_TABLE', 'tasks');

export const SUPABASE_URL = DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = DEFAULT_SUPABASE_ANON_KEY;
export const SUPABASE_ENTRIES_TABLE = DEFAULT_SUPABASE_ENTRIES_TABLE;
export const SUPABASE_MEMBERS_TABLE = DEFAULT_SUPABASE_MEMBERS_TABLE;
export const SUPABASE_HISTORY_TABLE = DEFAULT_SUPABASE_HISTORY_TABLE;
export const SUPABASE_TASKS_TABLE = DEFAULT_SUPABASE_TASKS_TABLE;

// --- SharePoint Configuration Defaults (still used by legacy task sync) ---
export const DEFAULT_SHAREPOINT_SITE_URL = "https://gmct98.sharepoint.com/sites/Finance";
export const DEFAULT_SHAREPOINT_MEMBERS_LIST_NAME = "Members_DataBase";
export const DEFAULT_SHAREPOINT_ENTRIES_LIST_NAME = "Finance_Records";
export const DEFAULT_SHAREPOINT_HISTORY_LIST_NAME = "Weekly_Service_History";
export const DEFAULT_SHAREPOINT_TASKS_LIST_NAME = "TASKS";

export const SHAREPOINT_SITE_URL = DEFAULT_SHAREPOINT_SITE_URL;
export const SHAREPOINT_MEMBERS_LIST_NAME = DEFAULT_SHAREPOINT_MEMBERS_LIST_NAME;
export const SHAREPOINT_ENTRIES_LIST_NAME = DEFAULT_SHAREPOINT_ENTRIES_LIST_NAME;
export const SHAREPOINT_TASKS_LIST_NAME = DEFAULT_SHAREPOINT_TASKS_LIST_NAME;

export const SHAREPOINT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

// --- App Defaults ---
export const DEFAULT_CURRENCY = 'CAD';
export const DEFAULT_MAX_CLASSES = 20;

// --- App Events ---
export const MANUAL_SYNC_EVENT = 'gmct-manual-sync';
