import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  clean: true,
  minify: false,
  outDir: 'dist',
  external: ['better-sqlite3'],
});
