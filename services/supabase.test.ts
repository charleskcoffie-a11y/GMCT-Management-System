import { describe, it, expect } from 'vitest';
import { resolveTableTarget } from './supabase';

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
