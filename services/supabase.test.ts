import { describe, it, expect, afterEach } from 'vitest';
import {
    configureSupabase,
    enhanceSupabaseErrorMessage,
    loadEntriesFromSupabase,
    resolveTableTarget,
} from './supabase';

const defaultTable = 'entries';

describe('resolveTableTarget', () => {
    it('keeps simple table names unchanged', () => {
        const result = resolveTableTarget('entries', defaultTable, 'entries');
        expect(result).toEqual({
            path: 'entries',
            label: 'entries',
            displayName: 'entries',
            table: 'entries',
        });
    });

    it('splits schema qualified names', () => {
        const result = resolveTableTarget('public.entries', defaultTable, 'entries');
        expect(result).toEqual({
            path: 'entries',
            schema: 'public',
            label: 'entries',
            displayName: 'public.entries',
            table: 'entries',
        });
    });

    it('supports quoted schema and table names', () => {
        const result = resolveTableTarget('"custom schema"."Entries Table"', defaultTable, 'entries');
        expect(result).toEqual({
            path: 'Entries%20Table',
            schema: 'custom schema',
            label: 'entries',
            displayName: 'custom schema.Entries Table',
            table: 'Entries Table',
        });
    });

    it('prefers the last dot when multiple exist', () => {
        const result = resolveTableTarget('finance.archive.entries', defaultTable, 'entries');
        expect(result).toEqual({
            path: 'entries',
            schema: 'finance.archive',
            label: 'entries',
            displayName: 'finance.archive.entries',
            table: 'entries',
        });
    });
});

describe('enhanceSupabaseErrorMessage', () => {
    it('appends guidance when Supabase reports a missing table', () => {
        const detail = "Could not find the table 'public.entries' in the schema cache";
        const enhanced = enhanceSupabaseErrorMessage(detail);
        expect(enhanced).toContain('Ensure the "public.entries" table exists in Supabase');
        expect(enhanced).toContain('. Ensure the');
    });

    it('leaves unrelated error messages unchanged', () => {
        const detail = 'JWT expired';
        expect(enhanceSupabaseErrorMessage(detail)).toBe(detail);
    });

    it('derives table names from relation missing errors', () => {
        const detail = 'relation "custom.entries" does not exist';
        const enhanced = enhanceSupabaseErrorMessage(detail);
        expect(enhanced).toContain('Ensure the "custom.entries" table exists in Supabase');
    });

    it('handles individually quoted schema and table relation errors', () => {
        const detail = 'relation "custom schema"."Entries Table" does not exist';
        const enhanced = enhanceSupabaseErrorMessage(detail);
        expect(enhanced).toContain('Ensure the "custom schema.Entries Table" table exists in Supabase');
    });

    it('avoids duplicate punctuation when the original message ends with a sentence terminator', () => {
        const detail = "Could not find the table 'public.entries' in the schema cache.";
        const enhanced = enhanceSupabaseErrorMessage(detail);
        expect(enhanced).toContain('schema cache. Ensure');
    });
});

describe('Supabase request guidance', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        configureSupabase('', '');
        if (originalFetch) {
            globalThis.fetch = originalFetch;
        }
    });

    it('mentions the configured table when Supabase rejects a request', async () => {
        configureSupabase('https://example.supabase.co', 'anon-key');
        const response = new Response(
            JSON.stringify({ message: "Could not find the table 'public.entries' in the schema cache" }),
            {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            },
        );
        let callCount = 0;
        globalThis.fetch = (async (...args) => {
            callCount += 1;
            return response;
        }) as typeof fetch;
        let caughtError: unknown;
        try {
            await loadEntriesFromSupabase('public.entries');
        } catch (error) {
            caughtError = error;
        }
        expect(callCount).toBe(1);
        if (!(caughtError instanceof Error)) {
            throw new Error('Expected Supabase request to throw an Error');
        }
        expect(caughtError.message).toMatch(/Supabase is configured to use the "public\.entries" entries table/i);
    });
});
