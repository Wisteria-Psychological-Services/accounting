/** Parse an exported report without evaluating any cell as code or a formula. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false, closedQuote = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else cell += char;
      continue;
    }
    if (char === '"') {
      if (cell || closedQuote) throw new Error('Invalid CSV quoting. Export the report again from QuickBooks.');
      quoted = true;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(cell); cell = ''; closedQuote = false;
      if (char !== ',') {
        rows.push(row); row = [];
        if (char === '\r' && input[i + 1] === '\n') i++;
      }
    } else {
      if (closedQuote && char.trim()) throw new Error('Unexpected text after a quoted CSV value.');
      if (!closedQuote) cell += char;
    }
  }
  if (quoted) throw new Error('The CSV ends inside a quoted field. Select a complete export.');
  if (cell || row.length || closedQuote) { row.push(cell); rows.push(row); }
  return rows;
}

/** Null means a blank source cell; posted monetary values use exact integer cents. */
export function parseMoney(value) {
  let text = String(value ?? '').trim();
  if (!text) return null;
  const parenthesized = text.startsWith('(') && text.endsWith(')');
  if (parenthesized) text = text.slice(1, -1);
  text = text.replace(/[$,\s]/g, '');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`Invalid monetary value: ${value}`);
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error('A monetary value exceeds the supported range.');
  return negative || parenthesized ? -cents : cents;
}

const sumValues = values => values.reduce((sum, value) => sum + (value ?? 0), 0);
const sumColumns = (nodes, count) => Array.from({ length: count }, (_, month) =>
  nodes.reduce((sum, node) => sum + (node.values[month] ?? 0), 0));

function checkEqual(actual, expected, label, months) {
  actual.forEach((value, i) => {
    if (value !== (expected[i] ?? 0)) {
      throw new Error(`${label} does not reconcile for ${months[i]}. No data was loaded.`);
    }
  });
}

function readSection(rows, headerIndex, startName, totalName, id, months, checkRecords) {
  const start = rows.findIndex((row, index) => index > headerIndex && row[0]?.trim() === startName);
  if (start < 0) return null;
  const end = rows.findIndex((row, index) => index > start && row[0]?.trim() === totalName);
  if (end < 0) throw new Error(`Missing ${totalName}. Use a complete Profit and Loss by Month export.`);
  const count = months.length;
  const readValues = index => Array.from({ length: count }, (_, month) => parseMoney(rows[index][month + 1]));
  const groupEnds = new Map();
  for (let index = start + 1; index < end; index++) {
    const label = rows[index][0]?.trim() ?? '';
    if (!label.startsWith('Total for ')) continue;
    const name = label.slice(10).trim();
    let opening = index - 1;
    while (opening > start && (rows[opening][0]?.trim() !== name || groupEnds.has(opening))) opening--;
    if (opening <= start) throw new Error(`Cannot locate the category for ${label}.`);
    groupEnds.set(opening, index);
  }

  function buildChildren(from, to, parentId) {
    const children = [];
    for (let index = from; index < to; index++) {
      const label = rows[index][0]?.trim();
      if (!label) continue;
      if (label.startsWith('Total for ')) throw new Error(`Unexpected subtotal: ${label}.`);
      const nodeId = `${parentId}/${index}`;
      const ownValues = readValues(index);
      const groupEnd = groupEnds.get(index);
      if (groupEnd !== undefined) {
        if (groupEnd >= to) throw new Error(`Overlapping category subtotals near ${label}.`);
        const nested = buildChildren(index + 1, groupEnd, nodeId);
        if (ownValues.some(value => value !== null)) {
          nested.unshift({ id: `${nodeId}/direct`, name: `${label} (direct)`, values: ownValues,
            children: [], sourceRow: index + 1, direct: true });
        }
        const values = sumColumns(nested, count);
        checkEqual(values, readValues(groupEnd), label, months);
        checkRecords.push({ label, sourceRow: groupEnd + 1 });
        children.push({ id: nodeId, name: label, values, children: nested, sourceRow: index + 1 });
        index = groupEnd;
      } else {
        children.push({ id: nodeId, name: label, values: ownValues, children: [], sourceRow: index + 1 });
      }
    }
    return children;
  }

  const children = buildChildren(start + 1, end, id);
  const values = sumColumns(children, count);
  checkEqual(values, readValues(end), startName, months);
  checkRecords.push({ label: startName, sourceRow: end + 1 });
  return { id, name: startName === 'Expenses' ? 'Operating expenses' : startName, values, children,
    sourceRow: start + 1, controlRow: end + 1 };
}

export function parseReport(csv, fileName = 'QuickBooks P&L.csv') {
  const rows = parseCsv(csv);
  const headerIndex = rows.findIndex(row => row.length >= 3 && /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(row[1]?.trim() ?? '') && row.at(-1)?.trim() === 'Total');
  if (headerIndex < 0) throw new Error('Use a QuickBooks Profit and Loss by Month CSV, with monthly columns and a Total column.');
  const months = rows[headerIndex].slice(1, -1).map(value => value.trim());
  if (months.length > 36 || new Set(months).size !== months.length) throw new Error('The report has duplicate months or more than 36 monthly columns.');
  const monthNumbers = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthKeys = months.map(label => {
    const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+\d{1,2}-\d{1,2})?\s+(\d{4})$/.exec(label);
    if (!match) throw new Error(`Unrecognized month column: ${label}.`);
    return Number(match[2]) * 12 + monthNumbers.indexOf(match[1]);
  });
  if (monthKeys.some((key, i) => i && key !== monthKeys[i - 1] + 1)) throw new Error('Monthly columns must be consecutive and in chronological order.');
  const checks = [];
  for (let index = headerIndex + 1; index < rows.length; index++) {
    const row = rows[index];
    if (!row[0]?.trim() || !row.slice(1).some(value => value.trim())) continue;
    if (row.length !== months.length + 2) throw new Error(`Unexpected column count on source row ${index + 1}.`);
    const values = row.slice(1, -1).map(parseMoney);
    const total = parseMoney(row.at(-1));
    if (total === null || sumValues(values) !== total) throw new Error(`The monthly values and Total do not agree on source row ${index + 1} (${row[0]}).`);
  }
  const sections = [
    readSection(rows, headerIndex, 'Expenses', 'Total Expenses', 'expenses', months, checks),
    readSection(rows, headerIndex, 'Cost of Goods Sold', 'Total Cost of Goods Sold', 'cogs', months, checks),
    readSection(rows, headerIndex, 'Other Expenses', 'Total Other Expenses', 'other', months, checks)
  ].filter(Boolean);
  if (!sections.some(section => section.id === 'expenses')) throw new Error('The report has no Expenses section.');
  const basisLine = rows.find(row => /^(Accrual|Cash) Basis\b/.test(row[0]?.trim() ?? ''))?.[0] ?? '';
  const company = rows[0]?.[0]?.trim() || 'QuickBooks';
  const reportTitle = rows[1]?.[0]?.trim() || 'Profit and Loss by Month';
  return { company, reportTitle, period: rows[2]?.[0]?.trim() || '',
    basis: basisLine.match(/^(Accrual|Cash) Basis/)?.[0] || 'Basis not stated', basisLine,
    fileName, months, sections, checks, sourceRows: rows.length };
}

export function amount(node, from, to) {
  return sumValues(node.values.slice(from, to + 1));
}

export function scopeRoot(report, scope) {
  if (scope === 'all') return { id: 'all', name: 'All expenses',
    values: sumColumns(report.sections, report.months.length), children: report.sections };
  return report.sections.find(section => section.id === scope) ?? report.sections[0];
}

export function findNode(root, id) {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function flattenLeaves(node, parents = []) {
  if (!node.children.length) return [{ ...node, path: [...parents, node.name] }];
  return node.children.flatMap(child => flattenLeaves(child, [...parents, node.name]));
}

/** Exports are safe to reopen in a spreadsheet, including user-controlled labels. */
export function csvCell(value) {
  const text = String(value);
  const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
