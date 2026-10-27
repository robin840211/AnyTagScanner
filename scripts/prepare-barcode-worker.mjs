import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const destination = new URL('public/vendor/barcode/', root);
await mkdir(destination, { recursive: true });
await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['app/barcode-worker.ts'],
  outfile: fileURLToPath(new URL('worker.js', destination)),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
});
await copyFile(new URL('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm', root), new URL('zxing_reader.wasm', destination));
await copyFile(new URL('node_modules/zxing-wasm/LICENSE', root), new URL('LICENSE.zxing-wasm', destination));
