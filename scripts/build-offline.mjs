import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { build } from 'esbuild';
import { projectRoot } from './build-web.mjs';
import { parseReport } from './profit-and-loss/pnl.mjs';

const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  if (!['--input', '--output'].includes(name) || !process.argv[index + 1]) throw new Error('Usage: npm run build:offline -- --input <P&L.csv> [--output <folder>]');
  options[name] = process.argv[index + 1];
}
if (!options['--input']) throw new Error('Provide --input with a QuickBooks Profit and Loss by Month CSV.');
const input = path.resolve(options['--input']);
const output = path.resolve(options['--output'] ?? path.join(projectRoot, 'dist'));
if (output === projectRoot || output === path.parse(output).root || output === path.dirname(input)) throw new Error('Choose a dedicated output folder separate from source and the original CSV.');
const bytes = await fs.readFile(input);
if (bytes.length > 5 * 1024 * 1024) throw new Error('Choose a CSV smaller than 5 MB.');
const csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const fileName = path.basename(input);
const report = parseReport(csv, fileName);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const initial = { mode: 'offline', csv, fileName, sha256: sha256(bytes), summary: {
  company: report.company, period: report.period, basis: report.basis,
} };
const result = await build({ entryPoints: [path.join(projectRoot, 'web/public/app.mjs')],
  bundle: true, minify: true, format: 'iife', platform: 'browser', write: false,
  target: ['chrome110', 'edge110', 'safari16.4'], legalComments: 'inline',
  plugins: [{ name: 'local-browser-assets', setup(builder) {
    builder.onResolve({ filter: /^\/vendor\/charts\.mjs$/ }, () => ({ path: path.join(projectRoot, 'web/vendor-entry.mjs') }));
    builder.onResolve({ filter: /^\/domain\/pnl\.mjs$/ }, () => ({ path: path.join(projectRoot, 'scripts/profit-and-loss/pnl.mjs') }));
  } }],
});
let html = await fs.readFile(path.join(projectRoot, 'web/public/index.html'), 'utf8');
const styles = await Promise.all(['shared/workbench.css', 'app.css', 'views/expense-explorer.css'].map(name => fs.readFile(path.join(projectRoot, 'web/public', name), 'utf8')));
html = html.replace(/  <link rel="stylesheet"[^>]+>\n/g, '').replace('  <script type="module" src="/app.mjs"></script>', '');
const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data: blob:; font-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'";
html = html.replace('</head>', () => `<meta http-equiv="Content-Security-Policy" content="${csp}">\n<style>${styles.join('\n')}</style>\n</head>`);
html = html.replace(/(<script id="initial-data" type="application\/json">)[\s\S]*?(<\/script>)/,
  () => '<script id="initial-data" type="application/json">' + JSON.stringify(initial).replaceAll('<', '\\u003c') + '</script>');
html = html.replace('</body>', () => `<script>${result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>\n</body>`);

const notices = [];
for (const dependency of ['echarts', 'zrender', 'tslib']) {
  for (const name of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'NOTICE', 'NOTICE.txt', 'CopyrightNotice.txt']) {
    try { notices.push(`${dependency} / ${name}\n\n${await fs.readFile(path.join(projectRoot, 'node_modules', dependency, name), 'utf8')}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
if (!notices.some(notice => notice.startsWith('echarts / LICENSE'))) throw new Error('ECharts license is missing.');
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'index.html.tmp'), html);
await fs.rename(path.join(output, 'index.html.tmp'), path.join(output, 'index.html'));
await fs.copyFile(input, path.join(output, 'Source P&L.csv'));
await fs.writeFile(path.join(output, 'Start Expense Explorer.cmd'), '@echo off\r\nstart "" "%~dp0index.html"\r\n');
await fs.writeFile(path.join(output, 'Third-party notices.txt'), notices.join('\n\n------------------------------------------------------------\n\n'));
await fs.writeFile(path.join(output, 'Read me.txt'), `Accounting Expense Explorer\r\n\r\nOpen index.html in Edge or Chrome from the synced folder, or run Start Expense Explorer.cmd. SharePoint's web preview may download HTML rather than run it.\r\n\r\nThe report and free ECharts library are embedded. No server or network is needed. Import CSV changes only the current session; reopening restores the bundled report. Report files from a private folder are available in the Node launcher version.\r\n\r\nThe supplied source CSV is preserved byte-for-byte. Keep this folder within the original report's approved audience.\r\n`);
const metadata = { appVersion: '0.2.0', sourceFile: fileName, sourceSha256: sha256(bytes), htmlSha256: sha256(html), subtotalChecks: report.checks.length, builtAt: new Date().toISOString() };
await fs.writeFile(path.join(output, 'build-info.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify({ output, htmlBytes: Buffer.byteLength(html), subtotalChecks: report.checks.length }));
