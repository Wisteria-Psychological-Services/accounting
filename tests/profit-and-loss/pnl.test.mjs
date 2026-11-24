import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseMoney, parseReport, scopeRoot, amount, flattenLeaves, findNode, csvCell } from '../../scripts/profit-and-loss/pnl.mjs';

const fixture = [
  'Example Company,,,', 'Profit and Loss by Month,,,', 'January 1-February 12, 2026,,,', '',
  ',Jan 2026,Feb 1-12 2026,Total',
  'Cost of Goods Sold,,,', 'Wages,500,600,1100', 'Total Cost of Goods Sold,500,600,1100',
  'Expenses,,,', 'Facilities,10,,10', 'Rent,100,100,200', 'Utilities,,,', 'Internet,20,25,45',
  'Total for Utilities,20,25,45', 'Total for Facilities,130,125,255',
  'Refunds,-5,,-5', 'Inactive,,,', 'Total Expenses,125,125,250',
  'Other Expenses,,,', 'Interest,3,4,7', 'Total Other Expenses,3,4,7',
  'Accrual Basis Thursday,,,', ''
].join('\r\n');

test('reads hierarchy and direct parent postings without double counting subtotals', () => {
  const report = parseReport(fixture);
  const expenses = scopeRoot(report, 'expenses');
  assert.equal(report.basis, 'Accrual Basis');
  assert.equal(amount(expenses, 0, 1), 25000);
  assert.equal(expenses.children[0].name, 'Facilities');
  assert.deepEqual(expenses.children[0].children.map(node => node.name), ['Facilities (direct)', 'Rent', 'Utilities']);
  assert.deepEqual(expenses.children[0].values, [13000, 12500]);
  assert.equal(flattenLeaves(expenses).length, 5);
  assert.equal(flattenLeaves(expenses).reduce((sum, node) => sum + amount(node, 0, 1), 0), 25000);
  assert.equal(report.checks.length, 5);
});

test('all-expense scope includes COGS and Other Expenses once, with month filters', () => {
  const report = parseReport(fixture);
  const all = scopeRoot(report, 'all');
  assert.deepEqual(all.children.map(node => node.id), ['expenses', 'cogs', 'other']);
  assert.equal(amount(all, 0, 0), 62800);
  assert.equal(amount(all, 1, 1), 72900);
  assert.equal(amount(all, 0, 1), 135700);
  const facilities = all.children[0].children[0];
  assert.equal(findNode(all, facilities.id), facilities);
  assert.equal(findNode(all, 'not-an-account'), null);
});

test('preserves blank, zero, credits and exact cents', () => {
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('$0.00'), 0);
  assert.equal(parseMoney('-$1,234.56'), -123456);
  assert.equal(parseMoney('($1,234.56)'), -123456);
  assert.equal(parseMoney('0.29'), 29);
  assert.throws(() => parseMoney('12.345'), /Invalid monetary/);
  const report = parseReport(fixture);
  assert.deepEqual(scopeRoot(report, 'expenses').children[1].values, [-500, null]);
});

test('rejects inconsistent row totals and source subtotals without loading a partial report', () => {
  assert.throws(() => parseReport(fixture.replace('Interest,3,4,7', 'Interest,3,4,8')), /monthly values and Total/);
  assert.throws(() => parseReport(fixture.replace('Total for Facilities,130,125,255', 'Total for Facilities,131,125,256')), /Facilities does not reconcile/);
  assert.throws(() => parseReport(fixture.replace('Total Expenses,125,125,250', 'Total Expenses,126,125,251')), /Expenses does not reconcile/);
});

test('CSV handles BOM, commas, escaped quotes and multiline fields', () => {
  assert.deepEqual(parseCsv('\uFEFF"a,b","say ""hi"""\r\n"multi\nline",x'), [['a,b', 'say "hi"'], ['multi\nline', 'x']]);
  assert.throws(() => parseCsv('"unfinished'), /inside a quoted field/);
  assert.throws(() => parseCsv('"closed"oops,x'), /Unexpected text/);
});

test('rejects unsupported or incomplete exports and formula-like money', () => {
  assert.throws(() => parseReport('Category,Amount\nRent,100'), /Profit and Loss by Month/);
  assert.throws(() => parseReport(fixture.replace('Feb 1-12 2026', 'Mar 2026')), /consecutive/);
  assert.throws(() => parseReport(fixture.replace('Feb 1-12 2026', 'Jan 2026')), /duplicate/);
  assert.throws(() => parseReport(fixture.replace('Total for Utilities', 'Total for Unknown')), /Cannot locate/);
  assert.throws(() => parseMoney('=1+1'), /Invalid monetary/);
  assert.throws(() => parseReport(fixture.replace('Total Expenses,125,125,250', '')), /Missing Total Expenses/);
});

test('CSV export escapes spreadsheet formulas in labels while preserving numeric credits', () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell(-1.25), '"-1.25"');
  assert.equal(csvCell('a,b'), '"a,b"');
});

test('zero expense report and optional missing sections are valid', () => {
  const empty = 'Example,,,\nProfit and Loss by Month,,,\nJanuary-February 2026,,,\n,Jan 2026,Feb 2026,Total\nExpenses,,,\nRent,,0,0\nTotal Expenses,0,0,0\nCash Basis,,,';
  const report = parseReport(empty);
  assert.equal(amount(scopeRoot(report, 'all'), 0, 1), 0);
  assert.equal(report.sections.length, 1);
  assert.deepEqual(flattenLeaves(report.sections[0])[0].values, [null, 0]);
});
