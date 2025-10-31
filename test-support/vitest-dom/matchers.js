async function loadExpect() {
  const attempts = [
    async () => {
      const module = await import('vitest');
      return module?.expect;
    },
    async () => {
      const module = await import(new URL('../vitest/index.js', import.meta.url).href);
      return module?.expect;
    },
    async () => {
      const module = await import(new URL('../../vitest/index.js', import.meta.url).href);
      return module?.expect;
    },
  ];

  for (const attempt of attempts) {
    try {
      const candidate = await attempt();
      if (typeof candidate === 'function') {
        return candidate;
      }
    } catch (error) {
      // Ignore resolution failures and try the next option.
    }
  }

  throw new Error('Unable to locate a compatible expect implementation for @vitest/dom.');
}

const expect = await loadExpect();

// This lightweight matcher bundle is a no-op placeholder to keep compatibility
// with expect.extend usages. Real DOM-specific matchers are not implemented.
expect.extend({});

export { expect };
export const matchers = {};
export default matchers;

