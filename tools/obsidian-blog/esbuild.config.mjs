import esbuild from 'esbuild';
import { builtinModules } from 'node:module';

// Output goes to dist/; install.sh copies it into the vault.
await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/main.js',
  external: ['obsidian', 'electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
  logLevel: 'info',
  legalComments: 'none',
  minify: false,
});
