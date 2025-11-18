import {
    SUPABASE_ANON_KEY,
    SUPABASE_ENTRIES_TABLE,
    SUPABASE_HISTORY_TABLE,
    SUPABASE_MEMBERS_TABLE,
    SUPABASE_TASKS_TABLE,
    SUPABASE_URL,
} from '../constants';
import type { Entry, Member, Task, WeeklyHistoryRecord } from '../types';
import { sanitizeEntry, sanitizeMember, sanitizeTask, sanitizeWeeklyHistoryRecord } from '../utils';

export type ConnectionResult = { success: true; message: string } | { success: false; message: string };

type SupabaseRow = Record<string, unknown>;

type MutableEntry = Entry & { spId?: string };
type MutableMember = Member & { spId?: string };
type MutableHistoryRecord = WeeklyHistoryRecord & { spId?: string };
type MutableTask = Task & { spId?: string };

const normalizeSupabaseValue = (value?: string): string => (typeof value === 'string' ? value.trim() : '');

let supabaseUrl = normalizeSupabaseValue(SUPABASE_URL);
let supabaseAnonKey = normalizeSupabaseValue(SUPABASE_ANON_KEY);

const getRestEndpoint = (): string => (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/rest/v1` : '');

export const configureSupabase = (url?: string, anonKey?: string) => {
    supabaseUrl = normalizeSupabaseValue(url);
    supabaseAnonKey = normalizeSupabaseValue(anonKey);
};

const assertSupabaseConfigured = (action: string) => {
    if (!getRestEndpoint()) {
        throw new Error(`Supabase URL is not configured. Unable to ${action}. Add it in Settings.`);
    }
    if (!supabaseAnonKey) {
        throw new Error(`Supabase anonymous key is not configured. Unable to ${action}. Add it in Settings.`);
    }
};

export const isSupabaseConfigured = (): boolean => Boolean(getRestEndpoint() && supabaseAnonKey);

export const resetSupabaseCache = () => {
    // no client-side caches yet, placeholder for API parity
};

type TableTarget = {
    path: string;
    schema?: string;
    label: string;
    displayName: string;
    table: string;
};

type TableContext = Pick<TableTarget, 'label' | 'displayName'>;

const buildTableContext = (table: TableTarget): TableContext => ({
    label: table.label,
    displayName: table.displayName,
});

const stripIdentifierQuotes = (segment: string): string => {
    const trimmed = segment.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
};

const parseQualifiedIdentifier = (value: string): { schema?: string; table: string } => {
    const trimmed = value.trim();
    if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
        return parseQualifiedIdentifier(trimmed.slice(1, -1));
    }

    const quotedMatch = trimmed.match(/^"([^"]+)"\."([^"]+)"$/);
    if (quotedMatch) {
        return {
            schema: stripIdentifierQuotes(quotedMatch[1]),
            table: stripIdentifierQuotes(quotedMatch[2]),
        };
    }

    const dotIndex = trimmed.lastIndexOf('.');
    if (dotIndex > 0 && dotIndex < trimmed.length - 1) {
        const schema = stripIdentifierQuotes(trimmed.slice(0, dotIndex));
        const table = stripIdentifierQuotes(trimmed.slice(dotIndex + 1));
        if (schema && table) {
            return { schema, table };
        }
    }

    return { table: stripIdentifierQuotes(trimmed) };
};

export const resolveTableTarget = (tableName: string | undefined, fallback: string, label: string): TableTarget => {
    const trimmed = (tableName ?? fallback ?? '').trim();
    if (!trimmed) {
        throw new Error(`Supabase ${label} table is not configured.`);
    }

    const { schema, table } = parseQualifiedIdentifier(trimmed);
    if (!table) {
        throw new Error(`Supabase ${label} table is not configured.`);
    }

    const encoded = encodeURIComponent(table);
    const displayName = schema ? `${schema}.${table}` : table;
    if (schema) {
        return { path: encoded, schema, label, displayName, table };
    }
    return { path: encoded, label, displayName, table };
};

const buildHeaders = (extra?: Record<string, string>): HeadersInit => ({
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
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

const missingTablePattern = /Could not find the table '([^']+)' in the schema cache/i;
const relationMissingPattern = /relation "([^"]+)" does not exist/i;

export const enhanceSupabaseErrorMessage = (message: string): string => {
    const match = missingTablePattern.exec(message) ?? relationMissingPattern.exec(message);
    if (!match) {
        return message;
    }

    const relation = match[1];
    const segments = relation.split('.');
    const tableName = segments[segments.length - 1] || relation;
    return `${message} Ensure the "${tableName}" table exists in Supabase (Settings → Supabase Configuration shows the expected table names).`;
};

type SupabaseRequestInit = RequestInit & { schema?: string };

async function supabaseRequest<T>(path: string, init: SupabaseRequestInit = {}): Promise<T> {
    assertSupabaseConfigured('communicate with Supabase');
    const restEndpoint = getRestEndpoint();
    const { schema, tableContext, headers, ...requestInit } = init;
    const schemaHeaders = schema ? { 'Accept-Profile': schema, 'Content-Profile': schema } : undefined;
    const baseHeaders = buildHeaders(schemaHeaders);
    const mergedHeaders = headers ? { ...baseHeaders, ...headers } : baseHeaders;
    const response = await fetch(`${restEndpoint}/${path}`, {
        ...requestInit,
        headers: mergedHeaders,
    });
    if (!response.ok) {
        const detail = enhanceSupabaseErrorMessage(await describeSupabaseError(response));
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

const normaliseTask = (row: SupabaseRow): Task => {
    const parsed = sanitizeTask({ ...row, spId: typeof row.spId === 'string' ? row.spId : row.id });
    return { ...parsed, spId: parsed.spId ?? parsed.id };
};

const buildDeleteFilter = (id: string): string => {
    const encoded = encodeURIComponent(id);
    return `id=eq.${encoded}`;
};

export async function loadEntriesFromSupabase(tableName?: string): Promise<Entry[]> {
    const table = resolveTableTarget(tableName, SUPABASE_ENTRIES_TABLE, 'entries');
    const rows = await supabaseRequest<SupabaseRow[]>(`${table.path}?select=*`, {
        schema: table.schema,
        tableContext: buildTableContext(table),
    });
    return Array.isArray(rows) ? rows.map(normaliseEntry) : [];
}

export async function loadMembersFromSupabase(tableName?: string): Promise<Member[]> {
    const table = resolveTableTarget(tableName, SUPABASE_MEMBERS_TABLE, 'members');
    const rows = await supabaseRequest<SupabaseRow[]>(`${table.path}?select=*`, {
        schema: table.schema,
        tableContext: buildTableContext(table),
    });
    return Array.isArray(rows) ? rows.map(normaliseMember) : [];
}

export async function loadWeeklyHistoryFromSupabase(tableName?: string): Promise<WeeklyHistoryRecord[]> {
    const table = resolveTableTarget(tableName, SUPABASE_HISTORY_TABLE, 'weekly history');
    const rows = await supabaseRequest<SupabaseRow[]>(`${table.path}?select=*`, {
        schema: table.schema,
        tableContext: buildTableContext(table),
    });
    return Array.isArray(rows) ? rows.map(normaliseWeeklyHistory) : [];
}

export async function loadTasksFromSupabase(tableName?: string): Promise<Task[]> {
    const table = resolveTableTarget(tableName, SUPABASE_TASKS_TABLE, 'tasks');
    const rows = await supabaseRequest<SupabaseRow[]>(`${table.path}?select=*`, {
        schema: table.schema,
        tableContext: buildTableContext(table),
    });
    return Array.isArray(rows) ? rows.map(normaliseTask) : [];
}

export async function upsertEntryToSupabase(entry: Entry, tableName?: string): Promise<string | undefined> {
    const table = resolveTableTarget(tableName, SUPABASE_ENTRIES_TABLE, 'entries');
    const sanitized: MutableEntry = { ...sanitizeEntry(entry) };
    sanitized.spId = sanitized.spId ?? sanitized.id;
    const body = JSON.stringify({ ...sanitized, id: sanitized.id });
    const result = await supabaseRequest<SupabaseRow[]>(`${table.path}?on_conflict=id`, {
        method: 'POST',
        schema: table.schema,
        tableContext: buildTableContext(table),
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body,
    });
    const saved = Array.isArray(result) ? result[0] : result;
    const remoteId = typeof saved?.id === 'string' ? saved.id : sanitized.id;
    return remoteId;
}

export async function upsertMemberToSupabase(member: Member, tableName?: string): Promise<string | undefined> {
    const table = resolveTableTarget(tableName, SUPABASE_MEMBERS_TABLE, 'members');
    const sanitized: MutableMember = { ...sanitizeMember(member) };
    sanitized.spId = sanitized.spId ?? sanitized.id;
    const body = JSON.stringify({ ...sanitized, id: sanitized.id });
    const result = await supabaseRequest<SupabaseRow[]>(`${table.path}?on_conflict=id`, {
        method: 'POST',
        schema: table.schema,
        tableContext: buildTableContext(table),
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body,
    });
    const saved = Array.isArray(result) ? result[0] : result;
    return typeof saved?.id === 'string' ? saved.id : sanitized.id;
}

export async function upsertWeeklyHistoryToSupabase(
    record: WeeklyHistoryRecord,
    tableName?: string,
): Promise<string | undefined> {
    const table = resolveTableTarget(tableName, SUPABASE_HISTORY_TABLE, 'weekly history');
    const sanitized: MutableHistoryRecord = { ...sanitizeWeeklyHistoryRecord(record) };
    sanitized.spId = sanitized.spId ?? sanitized.id;
    const body = JSON.stringify({ ...sanitized, id: sanitized.id });
    const result = await supabaseRequest<SupabaseRow[]>(`${table.path}?on_conflict=id`, {
        method: 'POST',
        schema: table.schema,
        tableContext: buildTableContext(table),
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body,
    });
    const saved = Array.isArray(result) ? result[0] : result;
    return typeof saved?.id === 'string' ? saved.id : sanitized.id;
}

export async function deleteEntryFromSupabase(entry: Entry, tableName?: string): Promise<void> {
    const table = resolveTableTarget(tableName, SUPABASE_ENTRIES_TABLE, 'entries');
    const id = entry.spId ?? entry.id;
    if (!id) {
        return;
    }
    await supabaseRequest(`${table.path}?${buildDeleteFilter(id)}`, {
        method: 'DELETE',
        schema: table.schema,
        tableContext: buildTableContext(table),
        headers: { Prefer: 'return=minimal' },
    });
}

export async function deleteMemberFromSupabase(member: Member, tableName?: string): Promise<void> {
    const table = resolveTableTarget(tableName, SUPABASE_MEMBERS_TABLE, 'members');
    const id = member.spId ?? member.id;
    if (!id) {
        return;
    }
    await supabaseRequest(`${table.path}?${buildDeleteFilter(id)}`, {
        method: 'DELETE',
        schema: table.schema,
        tableContext: buildTableContext(table),
        headers: { Prefer: 'return=minimal' },
    });
}

export async function deleteWeeklyHistoryFromSupabase(record: WeeklyHistoryRecord, tableName?: string): Promise<void> {
    const table = resolveTableTarget(tableName, SUPABASE_HISTORY_TABLE, 'weekly history');
    const id = record.spId ?? record.id;
    if (!id) {
        return;
    }
    await supabaseRequest(`${table.path}?${buildDeleteFilter(id)}`, {
        method: 'DELETE',
        schema: table.schema,
        tableContext: buildTableContext(table),
        headers: { Prefer: 'return=minimal' },
    });
}

export async function upsertTaskToSupabase(task: Task, tableName?: string): Promise<string | undefined> {
    const table = resolveTableTarget(tableName, SUPABASE_TASKS_TABLE, 'tasks');
    const sanitized: MutableTask = { ...sanitizeTask(task) };
    sanitized.spId = sanitized.spId ?? sanitized.id;
    const body = JSON.stringify({ ...sanitized, id: sanitized.id });
    const result = await supabaseRequest<SupabaseRow[]>(`${table.path}?on_conflict=id`, {
        method: 'POST',
        schema: table.schema,
        tableContext: buildTableContext(table),
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body,
    });
    const saved = Array.isArray(result) ? result[0] : result;
    return typeof saved?.id === 'string' ? saved.id : sanitized.id;
}

export async function deleteTaskFromSupabase(task: Task | { id: string; spId?: string }, tableName?: string): Promise<void> {
    const table = resolveTableTarget(tableName, SUPABASE_TASKS_TABLE, 'tasks');
    const id = task.spId ?? task.id;
    if (!id) {
        return;
    }
    await supabaseRequest(`${table.path}?${buildDeleteFilter(id)}`, {
        method: 'DELETE',
        schema: table.schema,
        tableContext: buildTableContext(table),
        headers: { Prefer: 'return=minimal' },
    });
}

export async function testSupabaseConnection(): Promise<ConnectionResult> {
    if (!isSupabaseConfigured()) {
        return { success: false, message: 'Supabase credentials are missing. Add your project URL and anon key in Settings.' };
    }
    try {
        const table = resolveTableTarget(undefined, SUPABASE_ENTRIES_TABLE, 'entries');
        await supabaseRequest(`${table.path}?select=id&limit=1`, {
            schema: table.schema,
            tableContext: buildTableContext(table),
        });
        return { success: true, message: 'Successfully connected to Supabase.' };
    } catch (error) {
        console.error('Supabase connectivity check failed', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unable to connect to Supabase right now.',
        };
    }
}
