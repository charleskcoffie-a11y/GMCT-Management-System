import { build, loadConfigFromFile, mergeConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function buildLegacyBundle() {
  const mode = process.env.MODE || process.env.NODE_ENV || 'production';
  const configPath = path.resolve(projectRoot, 'vite.config.ts');

  const loaded = await loadConfigFromFile({ command: 'build', mode }, configPath, projectRoot);
  const baseConfig = loaded?.config ?? {};

  const legacyConfig = mergeConfig(baseConfig, {
    configFile: false,
    root: projectRoot,
    build: {
      emptyOutDir: false,
      outDir: path.resolve(projectRoot, 'dist'),
      assetsDir: 'assets',
      target: 'es2015',
      sourcemap: false,
      manifest: false,
      modulePreload: false,
      lib: {
        entry: path.resolve(projectRoot, 'index.tsx'),
        name: 'GMCTApp',
        formats: ['iife'],
        fileName: () => 'assets/index-legacy.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });

  console.log('Building legacy GMCT bundle for older browsers...');
  await build(legacyConfig);
  console.log('Legacy bundle available at dist/assets/index-legacy.js');
}

buildLegacyBundle().catch((error) => {
  console.error('Failed to build the GMCT legacy bundle.');
  console.error(error);
  process.exitCode = 1;
});
