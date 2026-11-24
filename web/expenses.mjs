import { open, readdir, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseReport } from '../scripts/profit-and-loss/pnl.mjs';

export const maxReportBytes = 5 * 1024 * 1024;

export class ReportError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function reportName(name) {
  if (typeof name !== 'string' || name.length > 240 || name.startsWith('.') ||
      /[\\/:\u0000-\u001f]/.test(name) || !name.toLowerCase().endsWith('.csv')) {
    throw new ReportError(400, 'Choose a CSV from the report list.');
  }
  return name;
}

function inside(root, candidate) {
  const child = relative(root, candidate);
  return child && child !== '..' && !child.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) && !isAbsolute(child);
}

/** Read-only adapter for an approved private local or SharePoint-synced folder. */
export function createExpenseReports(dataRoot) {
  const root = dataRoot ? resolve(dataRoot) : null;
  let pinnedRoot, pinnedOriginals;

  async function originals() {
    if (!root) throw new ReportError(503, 'Set ACCOUNTING_DATA_ROOT to an existing private folder, or import a CSV in the browser.');
    try {
      const actualRoot = await realpath(root);
      const actualOriginals = await realpath(join(root, 'originals'));
      if (!inside(actualRoot, actualOriginals)) throw new Error('outside');
      if ((pinnedRoot && pinnedRoot !== actualRoot) || (pinnedOriginals && pinnedOriginals !== actualOriginals)) {
        throw new ReportError(409, 'The configured report folder changed. Restart Accounting after checking its location.');
      }
      pinnedRoot = actualRoot;
      pinnedOriginals = actualOriginals;
      return actualOriginals;
    } catch (error) {
      if (error instanceof ReportError) throw error;
      throw new ReportError(503, 'The private originals folder is unavailable. Check its location, sync status and access, then refresh.');
    }
  }

  async function list() {
    if (!root) return { configured: false, source: 'Browser import', files: [] };
    const folder = await originals();
    try {
      const entries = await readdir(folder, { withFileTypes: true });
      const files = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        try { reportName(entry.name); } catch { continue; }
        // Metadata is enough for the picker. File bytes are read only on selection.
        files.push({ name: entry.name });
      }
      files.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
      return { configured: true, source: 'Private originals folder', files };
    } catch {
      throw new ReportError(503, 'The private originals folder could not be listed. Check access and try again.');
    }
  }

  async function read(name) {
    const selected = reportName(name);
    const folder = await originals();
    let handle;
    try {
      const filename = join(folder, selected);
      const actualFile = await realpath(filename);
      if (!inside(folder, actualFile) || actualFile !== filename) {
        throw new ReportError(403, 'Choose an ordinary CSV directly inside the configured originals folder.');
      }
      handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const before = await handle.stat();
      if (!before.isFile() || before.size > maxReportBytes) throw new ReportError(413, 'Choose a CSV smaller than 5 MB.');
      const buffer = Buffer.alloc(maxReportBytes + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > maxReportBytes) throw new ReportError(413, 'Choose a CSV smaller than 5 MB.');
      const after = await handle.stat();
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || length !== after.size ||
          (await realpath(filename)) !== actualFile || (await originals()) !== folder) {
        throw new ReportError(409, 'The report changed while opening. Wait for saving or syncing to finish, then try again.');
      }
      const bytes = buffer.subarray(0, length);
      let csv;
      try {
        csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        parseReport(csv, selected);
      } catch {
        throw new ReportError(422, 'This file is not a valid, reconciled QuickBooks Profit and Loss by Month CSV. Import it directly for detailed validation.');
      }
      return { csv, fileName: selected, sha256: createHash('sha256').update(bytes).digest('hex') };
    } catch (error) {
      if (error instanceof ReportError) throw error;
      if (error.code === 'ENOENT') throw new ReportError(404, 'This report is no longer available. Refresh the list and choose another file.');
      if (error.code === 'ELOOP') throw new ReportError(403, 'Linked report files are not supported.');
      throw new ReportError(503, 'The report could not be read. Check its sync status and permissions, then try again.');
    } finally {
      await handle?.close();
    }
  }

  return { list, read };
}
