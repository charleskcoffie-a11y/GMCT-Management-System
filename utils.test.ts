import { describe, it, expect } from 'vitest';
import '@vitest/dom/matchers';
import { toCsv } from './utils';

describe('toCsv', () => {
  it('quotes values containing commas and leaves simple values unquoted', () => {
    const rows = [
      { name: 'Alice', note: 'Simple value' },
      { name: 'Bob', note: 'Hello, world' }
    ];

    const csv = toCsv(rows);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('name,note');
    expect(lines[1]).toBe('Alice,Simple value');
    expect(lines[2]).toBe('Bob,"Hello, world"');
  });
});
