import { describe, it, expect } from 'vitest';
import { enhanceSupabaseErrorMessage, resolveTableTarget } from './supabase';

const defaultTable = 'entries';

describe('resolveTableTarget', () => {
    it('keeps simple table names unchanged', () => {
        const result = resolveTableTarget('entries', defaultTable, 'entries');
        expect(result).toEqual({ path: 'entries' });
    });

    it('splits schema qualified names', () => {
        const result = resolveTableTarget('public.entries', defaultTable, 'entries');
        expect(result).toEqual({ path: 'entries', schema: 'public' });
    });

    it('supports quoted schema and table names', () => {
        const result = resolveTableTarget('"custom schema"."Entries Table"', defaultTable, 'entries');
        expect(result).toEqual({ path: 'Entries%20Table', schema: 'custom schema' });
    });

    it('prefers the last dot when multiple exist', () => {
        const result = resolveTableTarget('finance.archive.entries', defaultTable, 'entries');
        expect(result).toEqual({ path: 'entries', schema: 'finance.archive' });
    });
});

describe('enhanceSupabaseErrorMessage', () => {
    it('appends guidance when Supabase reports a missing table', () => {
        const detail = "Could not find the table 'public.entries' in the schema cache";
        const enhanced = enhanceSupabaseErrorMessage(detail);
        expect(enhanced).toContain('Ensure the "entries" table exists in Supabase');
        expect(enhanced).toContain('. Ensure the');
    });

    it('leaves unrelated error messages unchanged', () => {
        const detail = 'JWT expired';
        expect(enhanceSupabaseErrorMessage(detail)).toBe(detail);
    });

    it('derives table names from relation missing errors', () => {
        const detail = 'relation "custom.entries" does not exist';
        const enhanced = enhanceSupabaseErrorMessage(detail);
        expect(enhanced).toContain('Ensure the "entries" table exists in Supabase');
    });

    it('avoids duplicate punctuation when the original message ends with a sentence terminator', () => {
        const detail = "Could not find the table 'public.entries' in the schema cache.";
        const enhanced = enhanceSupabaseErrorMessage(detail);
        expect(enhanced).toContain('schema cache. Ensure');
    });

    it('fixes previously appended guidance that was missing a sentence boundary', () => {
        const detail = "Could not find the table 'public.entries' in the schema cache Ensure the \"entries\" table exists in Supabase (Settings → Supabase Configuration shows the expected table names).";
        const enhanced = enhanceSupabaseErrorMessage(detail);
        expect(enhanced).toBe("Could not find the table 'public.entries' in the schema cache. Ensure the \"entries\" table exists in Supabase (Settings → Supabase Configuration shows the expected table names).");
    });
});
