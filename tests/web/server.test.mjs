import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createAccountingServer } from '../../web/server.mjs';
import { ReportError } from '../../web/expenses.mjs';

async function launcher(t, reports) {
  const server = createAccountingServer({ reports });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

function request(origin, route, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(origin + route, options, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end();
  });
}

test('shell routes and assets use the same no-store boundary as private responses', async t => {
  const { origin } = await launcher(t);
  for (const route of ['/expenses', '/report-files', '/shared/workbench.css', '/views/expense-explorer.mjs', '/domain/pnl.mjs']) {
    const result = await request(origin, route);
    assert.equal(result.status, 200);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
    assert.match(result.headers['content-security-policy'], /frame-ancestors 'none'/);
  }
  assert.equal((await request(origin, '/package.json')).status, 404);
  assert.equal((await request(origin, '/originals/secret.csv')).status, 404);
});

test('report API passes a single filename to its adapter and preserves useful failures', async t => {
  const reads = [];
  const { origin } = await launcher(t, {
    list: async () => ({ configured: true, files: [{ name: 'Example.csv' }] }),
    read: async name => { reads.push(name); if (name === 'missing.csv') throw new ReportError(404, 'Refresh the list.'); return { fileName: name, csv: 'synthetic' }; },
  });
  assert.equal(JSON.parse((await request(origin, '/api/expenses/reports')).body).files.length, 1);
  assert.equal((await request(origin, '/api/expenses/report?name=Example.csv')).status, 200);
  assert.deepEqual(reads, ['Example.csv']);
  assert.equal((await request(origin, '/api/expenses/report?name=x&name=y')).status, 400);
  assert.equal((await request(origin, '/api/expenses/report?path=x')).status, 400);
  const missing = await request(origin, '/api/expenses/report?name=missing.csv');
  assert.equal(missing.status, 404);
  assert.equal(JSON.parse(missing.body).error, 'Refresh the list.');
});

test('rejects cross-site requests, forged hosts and all mutation methods', async t => {
  const { origin } = await launcher(t);
  assert.equal((await request(origin, '/api/expenses/reports', { headers: { Host: 'attacker.invalid' } })).status, 403);
  assert.equal((await request(origin, '/api/expenses/reports', { headers: { Origin: 'https://attacker.invalid' } })).status, 403);
  assert.equal((await request(origin, '/api/expenses/reports', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await request(origin, '/api/expenses/reports', { method: 'POST' })).status, 405);
});

test('unexpected errors do not disclose source records or paths', async t => {
  const { origin } = await launcher(t, { list: async () => { throw new Error('private path or amount'); } });
  const result = await request(origin, '/api/expenses/reports');
  assert.equal(result.status, 500);
  assert.doesNotMatch(result.body, /private path or amount/);
});
