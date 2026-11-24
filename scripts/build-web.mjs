import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export const projectRoot = fileURLToPath(new URL('..', import.meta.url));
export const chartBundle = path.join(projectRoot, '.cache/charts.mjs');

export async function buildWeb() {
  await fs.mkdir(path.dirname(chartBundle), { recursive: true });
  await build({ entryPoints: [path.join(projectRoot, 'web/vendor-entry.mjs')], bundle: true,
    minify: true, format: 'esm', platform: 'browser', target: ['chrome110', 'edge110', 'safari16.4'],
    outfile: chartBundle, legalComments: 'inline' });
  console.log('Local chart assets are ready.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await buildWeb();
