import {
    SUPABASE_ANON_KEY,
    SUPABASE_ENTRIES_TABLE,
    SUPABASE_HISTORY_TABLE,
    SUPABASE_MEMBERS_TABLE,
    SUPABASE_URL,
} from '../constants';
import type { Entry, Member, WeeklyHistoryRecord } from '../types';
import { sanitizeEntry, sanitizeMember, sanitizeWeeklyHistoryRecord } from '../utils';

export type ConnectionResult = { success: true; message: string } | { success: false; message: string };

type SupabaseRow = Record<string, unknown>;

type MutableEntry = Entry & { spId?: string };
type MutableMember = Member & { spId?: string };
type MutableHistoryRecord = WeeklyHistoryRecord & { spId?: string };

const REST_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1` : '';

const assertSupabaseConfigured = (action: string) => {
    if (!REST_ENDPOINT) {
        throw new Error(`Supabase URL is not configured. Unable to ${action}. Set VITE_SUPABASE_URL in your environment.`);
    }
    if (!SUPABASE_ANON_KEY) {
        throw new Error(`Supabase anonymous key is not configured. Unable to ${action}. Set VITE_SUPABASE_ANON_KEY.`);
    }
};

export const isSupabaseConfigured = (): boolean => Boolean(REST_ENDPOINT && SUPABASE_ANON_KEY);

export const resetSupabaseCache = () => {
    // no client-side caches yet, placeholder for API parity
};

const tablePath = (tableName: string | undefined, fallback: string, label: string): string => {
    const trimmed = (tableName ?? fallback ?? '').trim();
    if (!trimmed) {
        throw new Error(`Supabase ${label} table is not configured.`);
    }
    return encodeURIComponent(trimmed);
};

const buildHeaders = (extra?: Record<string, string>): HeadersInit => ({
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(extra ?? {}),
});

type SupabaseErrorPayload = { message?: string; details?: string; hint?: string };

const describeSupabaseError = async (response: Response): Promise<string> => {
    try {
        const payload = await response.json() as SupabaseErrorPayload;
        const detail = payload.message || payload.details || payload.hint;
        if (detail) {
            return detail;
        }
    } catch {
        try {
            return await response.text();
        } catch {
            // ignore
        }
    }
    return `status ${response.status}`;
};

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    assertSupabaseConfigured('communicate with Supabase');
    const response = await fetch(`${REST_ENDPOINT}/${path}`, {
        ...init,
        headers: init.headers ?? buildHeaders(),
    });
    if (!response.ok) {
        const detail = await describeSupabaseError(response);
        throw new Error(`Supabase request failed: ${detail}`);
    }
    if (response.status === 204) {
        return undefined as T;
    }
    const text = await response.text();
    if (!text) {
        return undefined as T;
    }
    return JSON.parse(text) as T;
}

const normaliseEntry = (row: SupabaseRow): Entry => {
    const parsed = sanitizeEntry({ ...row, spId: typeof row.spId === 'string' ? row.spId : row.id });
    return { ...parsed, spId: parsed.spId ?? parsed.id };
};

const normaliseMember = (row: SupabaseRow): Member => {
    const parsed = sanitizeMember({ ...row, spId: typeof row.spId === 'string' ? row.spId : row.id });
    return { ...parsed, spId: parsed.spId ?? parsed.id };
};

const normaliseWeeklyHistory = (row: SupabaseRow): WeeklyHistoryRecord => {
    const parsed = sanitizeWeeklyHistoryRecord({ ...row, spId: typeof row.spId === 'string' ? row.spId : row.id });
    return { ...parsed, spId: parsed.spId ?? parsed.id };
};

const buildDeleteFilter = (id: string): string => {
    const encoded = encodeURIComponent(id);
    return `id=eq.${encoded}`;
};

export async function loadEntriesFromSupabase(tableName?: string): Promise<Entry[]> {
    const table = tablePath(tableName, SUPABASE_ENTRIES_TABLE, 'entries');
    const rows = await supabaseRequest<SupabaseRow[]>(`${table}?select=*`);
    return Array.isArray(rows) ? rows.map(normaliseEntry) : [];
}

export async function loadMembersFromSupabase(tableName?: string): Promise<Member[]> {
    const table = tablePath(tableName, SUPABASE_MEMBERS_TABLE, 'members');
    const rows = await supabaseRequest<SupabaseRow[]>(`${table}?select=*`);
    return Array.isArray(rows) ? rows.map(normaliseMember) : [];
}

export async function loadWeeklyHistoryFromSupabase(tableName?: string): Promise<WeeklyHistoryRecord[]> {
    const table = tablePath(tableName, SUPABASE_HISTORY_TABLE, 'weekly history');
    const rows = await supabaseRequest<SupabaseRow[]>(`${table}?select=*`);
    return Array.isArray(rows) ? rows.map(normaliseWeeklyHistory) : [];
}

export async function upsertEntryToSupabase(entry: Entry, tableName?: string): Promise<string | undefined> {
    const table = tablePath(tableName, SUPABASE_ENTRIES_TABLE, 'entries');
    const sanitized: MutableEntry = { ...sanitizeEntry(entry) };
    sanitized.spId = sanitized.spId ?? sanitized.id;
    const body = JSON.stringify({ ...sanitized, id: sanitized.id });
    const result = await supabaseRequest<SupabaseRow[]>(`${table}?on_conflict=id`, {
        method: 'POST',
        headers: buildHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body,
    });
    const saved = Array.isArray(result) ? result[0] : result;
    const remoteId = typeof saved?.id === 'string' ? saved.id : sanitized.id;
    return remoteId;
}

export async function upsertMemberToSupabase(member: Member, tableName?: string): Promise<string | undefined> {
    const table = tablePath(tableName, SUPABASE_MEMBERS_TABLE, 'members');
    const sanitized: MutableMember = { ...sanitizeMember(member) };
    sanitized.spId = sanitized.spId ?? sanitized.id;
    const body = JSON.stringify({ ...sanitized, id: sanitized.id });
    const result = await supabaseRequest<SupabaseRow[]>(`${table}?on_conflict=id`, {
        method: 'POST',
        headers: buildHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body,
    });
    const saved = Array.isArray(result) ? result[0] : result;
    return typeof saved?.id === 'string' ? saved.id : sanitized.id;
}

export async function upsertWeeklyHistoryToSupabase(
    record: WeeklyHistoryRecord,
    tableName?: string,
): Promise<string | undefined> {
    const table = tablePath(tableName, SUPABASE_HISTORY_TABLE, 'weekly history');
    const sanitized: MutableHistoryRecord = { ...sanitizeWeeklyHistoryRecord(record) };
    sanitized.spId = sanitized.spId ?? sanitized.id;
    const body = JSON.stringify({ ...sanitized, id: sanitized.id });
    const result = await supabaseRequest<SupabaseRow[]>(`${table}?on_conflict=id`, {
        method: 'POST',
        headers: buildHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body,
    });
    const saved = Array.isArray(result) ? result[0] : result;
    return typeof saved?.id === 'string' ? saved.id : sanitized.id;
}

export async function deleteEntryFromSupabase(entry: Entry, tableName?: string): Promise<void> {
    const table = tablePath(tableName, SUPABASE_ENTRIES_TABLE, 'entries');
    const id = entry.spId ?? entry.id;
    if (!id) {
        return;
    }
    await supabaseRequest(`${table}?${buildDeleteFilter(id)}`, {
        method: 'DELETE',
        headers: buildHeaders({ Prefer: 'return=minimal' }),
    });
}

export async function deleteMemberFromSupabase(member: Member, tableName?: string): Promise<void> {
    const table = tablePath(tableName, SUPABASE_MEMBERS_TABLE, 'members');
    const id = member.spId ?? member.id;
    if (!id) {
        return;
    }
    await supabaseRequest(`${table}?${buildDeleteFilter(id)}`, {
        method: 'DELETE',
        headers: buildHeaders({ Prefer: 'return=minimal' }),
    });
}

export async function deleteWeeklyHistoryFromSupabase(record: WeeklyHistoryRecord, tableName?: string): Promise<void> {
    const table = tablePath(tableName, SUPABASE_HISTORY_TABLE, 'weekly history');
    const id = record.spId ?? record.id;
    if (!id) {
        return;
    }
    await supabaseRequest(`${table}?${buildDeleteFilter(id)}`, {
        method: 'DELETE',
        headers: buildHeaders({ Prefer: 'return=minimal' }),
    });
}

export async function testSupabaseConnection(): Promise<ConnectionResult> {
    if (!isSupabaseConfigured()) {
        return { success: false, message: 'Supabase environment variables are missing. Update VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    }
    try {
        const table = tablePath(undefined, SUPABASE_ENTRIES_TABLE, 'entries');
        await supabaseRequest(`${table}?select=id&limit=1`);
        return { success: true, message: 'Successfully connected to Supabase.' };
    } catch (error) {
        console.error('Supabase connectivity check failed', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unable to connect to Supabase right now.',
        };
    }
}
