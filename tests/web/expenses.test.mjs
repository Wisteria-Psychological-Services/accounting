import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createExpenseReports, maxReportBytes } from '../../web/expenses.mjs';

const example = await fs.readFile(new URL('../../examples/profit-and-loss.csv', import.meta.url));

async function privateFolder(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'accounting-test-'));
  await fs.mkdir(path.join(root, 'originals'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('accounting-test-'));
    return fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

test('unconfigured launcher supports browser import without pretending files are available', async () => {
  const reports = createExpenseReports();
  assert.deepEqual(await reports.list(), { configured: false, source: 'Browser import', files: [] });
  await assert.rejects(reports.read('report.csv'), error => error.status === 503);
});

test('reads only validated direct CSV files and preserves source bytes', async t => {
  const root = await privateFolder(t);
  const original = path.join(root, 'originals', 'Report 1.csv');
  await fs.writeFile(original, example);
  await fs.writeFile(path.join(root, 'originals', 'ignore.txt'), 'not a report');
  await fs.mkdir(path.join(root, 'originals', 'nested.csv'));
  const reports = createExpenseReports(root);
  assert.deepEqual((await reports.list()).files, [{ name: 'Report 1.csv' }]);
  const loaded = await reports.read('Report 1.csv');
  assert.equal(loaded.csv, example.toString('utf8'));
  assert.equal(loaded.sha256, createHash('sha256').update(example).digest('hex'));
  assert.deepEqual(await fs.readFile(original), example);
  assert.equal('path' in loaded, false);
});

test('refresh reads a replaced source and rejects a deleted or invalid report', async t => {
  const root = await privateFolder(t);
  const filename = path.join(root, 'originals', 'Report.csv');
  await fs.writeFile(filename, example);
  const reports = createExpenseReports(root);
  const first = await reports.read('Report.csv');
  await fs.writeFile(filename, example.toString().replace('Example Company', 'Another Example'));
  assert.notEqual((await reports.read('Report.csv')).sha256, first.sha256);
  await fs.writeFile(filename, 'Account,Amount\nRent,bad');
  await assert.rejects(reports.read('Report.csv'), error => error.status === 422 && !error.message.includes(root));
  await fs.unlink(filename);
  await assert.rejects(reports.read('Report.csv'), error => error.status === 404);
});

test('denies traversal, alternate streams, absolute paths and oversized reports', async t => {
  const root = await privateFolder(t);
  const reports = createExpenseReports(root);
  for (const name of ['../secret.csv', '..\\secret.csv', '/secret.csv', 'C:\\secret.csv', 'a.csv:stream', '.hidden.csv', 'x\u0000.csv']) {
    await assert.rejects(reports.read(name), error => error.status === 400);
  }
  await fs.writeFile(path.join(root, 'originals', 'huge.csv'), Buffer.alloc(maxReportBytes + 1));
  await assert.rejects(reports.read('huge.csv'), error => error.status === 413);
});

test('missing folder errors expose recovery guidance rather than private paths', async t => {
  const root = await privateFolder(t);
  await fs.rmdir(path.join(root, 'originals'));
  const reports = createExpenseReports(root);
  await assert.rejects(reports.list(), error => error.status === 503 && !error.message.includes(root));
});

test('file links cannot escape the configured originals folder', async t => {
  const root = await privateFolder(t);
  const outside = path.join(root, 'outside.csv');
  await fs.writeFile(outside, example);
  const linked = path.join(root, 'originals', 'linked.csv');
  try { await fs.symlink(outside, linked); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Creating symlinks requires an unavailable OS privilege.'); return; } throw error; }
  const reports = createExpenseReports(root);
  assert.deepEqual((await reports.list()).files, []);
  await assert.rejects(reports.read('linked.csv'), error => error.status === 403);
});
