#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
import { reset, run } from './index.js';

const root = process.cwd();
const args = process.argv.slice(2);
const shouldWatch = args.includes('--watch');

if (shouldWatch) {
  console.warn('Watch mode is not supported in this lightweight runner.');
}

const tscPath = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const tscResult = spawnSync(tscPath, ['--project', 'tsconfig.vitest.json'], {
  stdio: 'inherit',
});

if (tscResult.status !== 0) {
  process.exit(tscResult.status ?? 1);
}

const compiledDir = path.join(root, '.vitest-tmp');
await ensureVitestShim(root, compiledDir);
await fixCompiledImports(compiledDir);
const compiledTests = await findCompiledTests(compiledDir);

if (compiledTests.length === 0) {
  console.log('No compiled tests found.');
  process.exit(0);
}

reset();

for (const file of compiledTests) {
  const moduleUrl = pathToFileURL(file).href;
  await import(moduleUrl);
}

const result = await run();
if (!result.success) {
  process.exit(1);
}

async function findCompiledTests(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findCompiledTests(fullPath);
      files.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function fixCompiledImports(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await fixCompiledImports(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const original = await fs.readFile(fullPath, 'utf8');
      const updated = original
        .replace(/(from\s+['"])(\.\.?\/[^'"\n]*)(['"])/g, (match, start, spec, end) => {
          return start + ensureJsExtension(spec) + end;
        })
        .replace(/(import\(\s*['"])(\.\.?\/[^'"\n]*)(['"]\s*\))/g, (match, start, spec, end) => {
          return start + ensureJsExtension(spec) + end;
        });

      if (original !== updated) {
        await fs.writeFile(fullPath, updated, 'utf8');
      }
    }
  }
}

function ensureJsExtension(spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return spec;
  if (spec.endsWith('.js') || spec.endsWith('.mjs') || spec.endsWith('.cjs') || spec.endsWith('.json')) {
    return spec;
  }
  return `${spec}.js`;
}

async function ensureVitestShim(rootDir, compiledDir) {
  const shimDir = path.join(rootDir, 'test-support', 'vitest');
  const shimFiles = ['index.js', 'bin.js', 'package.json'];
  const targetDir = path.join(compiledDir, 'node_modules', 'vitest');

  await fs.mkdir(targetDir, { recursive: true });

  await Promise.all(
    shimFiles.map(async file => {
      const source = path.join(shimDir, file);
      const destination = path.join(targetDir, file);
      try {
        await fs.copyFile(source, destination);
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          throw new Error(`Unable to locate Vitest shim file at ${source}`);
        }
        throw error;
      }
    }),
  );
}

