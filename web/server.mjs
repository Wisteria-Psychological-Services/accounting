import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createExpenseReports, ReportError } from './expenses.mjs';
import { buildWeb, chartBundle, projectRoot } from '../scripts/build-web.mjs';

const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
const assets = new Map([
  ['/', ['index.html', 'text/html']], ['/expenses', ['index.html', 'text/html']],
  ['/report-files', ['index.html', 'text/html']], ['/app.mjs', ['app.mjs', 'text/javascript']],
  ['/app.css', ['app.css', 'text/css']], ['/shared/workbench.css', ['shared/workbench.css', 'text/css']],
  ['/views/expense-explorer.mjs', ['views/expense-explorer.mjs', 'text/javascript']],
  ['/views/expense-explorer.css', ['views/expense-explorer.css', 'text/css']],
  ['/views/report-files.mjs', ['views/report-files.mjs', 'text/javascript']],
  ['/components/api.mjs', ['components/api.mjs', 'text/javascript']]
]);
const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; object-src 'none'";

function json(response, value, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(value));
}

/** Same-origin, read-only loopback launcher; all filesystem access stays in adapters. */
export function createAccountingServer({ dataRoot, reports = createExpenseReports(dataRoot) } = {}) {
  return createServer({ requestTimeout: 30000, headersTimeout: 10000 }, async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', csp);
    try {
      const address = `127.0.0.1:${request.socket.localPort}`;
      const origin = `http://${address}`;
      const url = new URL(request.url, origin);
      if (request.headers.host !== address || url.origin !== origin ||
          (request.headers.origin && request.headers.origin !== origin) ||
          (url.pathname.startsWith('/api/') && request.headers['sec-fetch-site'] === 'cross-site')) {
        throw new ReportError(403, 'Open Accounting using its printed loopback address.');
      }
      if (request.method !== 'GET') throw new ReportError(405, 'This launcher provides read-only GET requests.');
      if (url.pathname === '/api/expenses/reports') return json(response, await reports.list());
      if (url.pathname === '/api/expenses/report') {
        if ([...url.searchParams.keys()].some(key => key !== 'name') || url.searchParams.getAll('name').length !== 1) {
          throw new ReportError(400, 'Select one report from the list.');
        }
        return json(response, await reports.read(url.searchParams.get('name')));
      }
      if (url.pathname === '/api/expenses/example') {
        const csv = await readFile(join(projectRoot, 'examples/profit-and-loss.csv'), 'utf8');
        return json(response, { csv, fileName: 'Synthetic example.csv', synthetic: true });
      }
      let file, contentType;
      if (url.pathname === '/vendor/charts.mjs') { file = chartBundle; contentType = 'text/javascript'; }
      else if (url.pathname === '/domain/pnl.mjs') { file = join(projectRoot, 'scripts/profit-and-loss/pnl.mjs'); contentType = 'text/javascript'; }
      else {
        const asset = assets.get(url.pathname);
        if (!asset) throw new ReportError(404, 'Not found.');
        [file, contentType] = [join(publicRoot, asset[0]), asset[1]];
      }
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` }).end(bytes);
    } catch (error) {
      const status = error instanceof ReportError ? error.status : 500;
      json(response, { error: error instanceof ReportError ? error.message : 'Accounting could not complete the request. Check the local setup and try again.' }, status);
    }
  });
}

export async function startServer({ dataRoot = process.env.ACCOUNTING_DATA_ROOT, port = Number(process.env.ACCOUNTING_WEB_PORT ?? 8790) } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('ACCOUNTING_WEB_PORT must be an integer from 1 to 65535.');
  await buildWeb();
  const server = createAccountingServer({ dataRoot });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  console.log(`Accounting is ready at http://127.0.0.1:${server.address().port}/expenses`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startServer().catch(() => { console.error('Could not start Accounting. Check Node.js 24, the dependencies and local port.'); process.exitCode = 1; });
}
