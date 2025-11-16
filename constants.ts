// constants.ts

// --- Application Metadata ---
export const APP_VERSION = '0.0.0';

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

// --- App Defaults ---
export const DEFAULT_CURRENCY = 'CAD';
export const DEFAULT_MAX_CLASSES = 20;

// --- App Events ---
export const MANUAL_SYNC_EVENT = 'gmct-manual-sync';
