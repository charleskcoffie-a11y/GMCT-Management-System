const state = (globalThis.__vitestState ??= {
  suites: [],
  tests: [],
  beforeEach: [],
  afterEach: [],
  failed: false,
});

export function reset() {
  state.tests = [];
  state.suites = [];
  state.beforeEach = [];
  state.afterEach = [];
  state.failed = false;
}

function currentTitle(name) {
  const parts = [...state.suites, name];
  return parts.filter(Boolean).join(' › ');
}

export function describe(name, fn) {
  state.suites.push(name);
  try {
    fn();
  } finally {
    state.suites.pop();
  }
}

export const suite = describe;

export function it(name, fn) {
  state.tests.push({ name: currentTitle(name), fn });
}

export const test = it;

export function beforeEach(fn) {
  state.beforeEach.push(fn);
}

export function afterEach(fn) {
  state.afterEach.push(fn);
}

const customMatchers = {};

export function expect(actual) {
  const baseMatchers = {
    toBe(expected) {
      if (!Object.is(actual, expected)) {
        throw new Error(`Expected ${formatValue(actual)} to be ${formatValue(expected)}`);
      }
    },
    toEqual(expected) {
      if (!deepEqual(actual, expected)) {
        throw new Error(`Expected ${formatValue(actual)} to equal ${formatValue(expected)}`);
      }
    },
    toContain(expected) {
      if (typeof actual?.includes !== 'function' || !actual.includes(expected)) {
        throw new Error(`Expected ${formatValue(actual)} to contain ${formatValue(expected)}`);
      }
    },
    toMatch(expected) {
      const regex = expected instanceof RegExp ? expected : new RegExp(String(expected));
      if (typeof actual !== 'string' || !regex.test(actual)) {
        throw new Error(`Expected ${formatValue(actual)} to match ${String(regex)}`);
      }
    }
  };

  const matcherEntries = Object.entries(customMatchers).map(([name, matcher]) => {
    return [name, (...args) => {
      const result = matcher(actual, ...args);
      if (result && typeof result === 'object') {
        if (!result.pass) {
          const message = typeof result.message === 'function' ? result.message() : result.message;
          throw new Error(message || `Expectation failed for matcher ${name}`);
        }
      } else if (!result) {
        throw new Error(`Expectation failed for matcher ${name}`);
      }
    }];
  });

  return Object.assign({}, baseMatchers, Object.fromEntries(matcherEntries));
}

expect.extend = function extend(matchers) {
  Object.assign(customMatchers, matchers ?? {});
};

export const vi = {
  fn(impl = () => {}) {
    const mockFn = (...args) => {
      mockFn.mock.calls.push(args);
      return impl(...args);
    };
    mockFn.mock = { calls: [] };
    return mockFn;
  },
};

export async function run() {
  let passed = 0;
  for (const { name, fn } of state.tests) {
    try {
      for (const hook of state.beforeEach) {
        await hook();
      }
      await fn();
      for (const hook of state.afterEach) {
        await hook();
      }
      console.log(`\u2713 ${name}`);
      passed += 1;
    } catch (error) {
      console.error(`\u2717 ${name}`);
      console.error(error instanceof Error ? error.stack : error);
      state.failed = true;
    }
  }

  const total = state.tests.length;
  if (state.failed) {
    console.error(`\n${passed}/${total} tests passed.`);
  } else {
    console.log(`\n${passed}/${total} tests passed.`);
  }

  return { success: !state.failed, passed, total };
}

function formatValue(value) {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  return JSON.stringify(value);
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => deepEqual(a[key], b[key]));
}

