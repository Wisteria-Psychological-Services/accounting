import { init, version as chartVersion } from '/vendor/charts.mjs';
import { parseReport, scopeRoot, findNode, amount, flattenLeaves, csvCell } from '/domain/pnl.mjs';

export function mountExpenseExplorer(panel, { initial = null, onLoaded = () => {} } = {}) {
  const $ = id => panel.querySelector('#' + id);
  const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  const compactMoney = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100);
  const html = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const palette = ['#a6e9cb', '#8bb7e5', '#e4c887', '#cdadce', '#e5ab99', '#7fc9bb', '#a9b2e4', '#d1c296'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let report, provenance, state;
  let donut, trend, loadEpoch = 0;
  function ensureCharts() {
    if (donut) return;
    donut = init($('donut'), null, { renderer: 'svg' });
    trend = init($('trend'), null, { renderer: 'svg' });
    donut.on('click', params => { const { node } = currentContext(); if (node.children.length && params.data?.id) navigate(params.data.id); });
    trend.on('click', params => { state.from += params.dataIndex; state.to = state.from; render(); });
  }

  function setColors(node, depth = 0, index = 0) {
    node.color = palette[(index + depth * 2) % palette.length];
    node.children.forEach((child, childIndex) => setColors(child, depth + 1, childIndex));
  }

  function installReport(nextReport, metadata) {
    nextReport.sections.forEach((section, index) => setColors(section, 0, index));
    report = nextReport;
    provenance = metadata;
    for (const control of panel.querySelectorAll('[data-requires-report] button, [data-requires-report] select, [data-requires-report] input')) control.disabled = false;
    $('source-button').disabled = false;
    state = { scope: 'expenses', from: 0, to: report.months.length - 1, path: [], search: '', sort: 'amount', inactive: false };
    $('company').textContent = report.company;
    $('report-caption').textContent = `${report.reportTitle} · ${report.period} · ${report.basis}`;
    $('empty-state').hidden = true;
    for (const section of panel.querySelectorAll('[data-requires-report]')) section.hidden = false;
    $('source-button').disabled = false;
    $('export-button').disabled = false;
    ensureCharts();
    onLoaded({ company: report.company, fileName: report.fileName, period: report.period, basis: report.basis });
    for (const id of ['from-month', 'to-month']) {
      $(id).replaceChildren(...report.months.map((month, index) => new Option(month, index)));
    }
    for (const option of $('scope').options) {
      option.disabled = option.value !== 'all' && !report.sections.some(section => section.id === option.value);
    }
    $('scope').value = state.scope;
    $('search').value = '';
    $('inactive').checked = false;
    $('sort').value = 'amount';
    $('message').hidden = true;
    $('monthly-table').hidden = true;
    $('table-button').setAttribute('aria-expanded', 'false');
    $('table-button').textContent = 'Show monthly values';
    $('source-summary').textContent = `${report.fileName} · ${report.checks.length} category and section totals reconciled`;
    $('basis').textContent = report.basis;
    render();
  }

  function currentContext() {
    const root = scopeRoot(report, state.scope);
    const path = state.path.map(id => findNode(root, id)).filter(Boolean);
    return { root, path, node: path.at(-1) ?? root };
  }

  function periodLabel() {
    return state.from === state.to ? report.months[state.from] : `${report.months[state.from]} – ${report.months[state.to]}`;
  }

  function navigate(id) {
    const { root, path } = currentContext();
    const priorIndex = path.findIndex(node => node.id === id);
    if (id === root.id) state.path = [];
    else if (priorIndex >= 0) state.path = state.path.slice(0, priorIndex + 1);
    else state.path.push(id);
    state.search = '';
    $('search').value = '';
    render();
    $('category-title').focus({ preventScroll: true });
  }

  function renderBreadcrumbs(root, path) {
    const nodes = [root, ...path];
    $('breadcrumbs').replaceChildren();
    nodes.forEach((node, index) => {
      if (index) {
        const divider = document.createElement('span');
        divider.className = 'divider'; divider.textContent = '/'; divider.setAttribute('aria-hidden', 'true');
        $('breadcrumbs').append(divider);
      }
      const crumb = document.createElement(index === nodes.length - 1 ? 'span' : 'button');
      crumb.textContent = node.name;
      if (crumb.tagName === 'BUTTON') crumb.addEventListener('click', () => navigate(node.id));
      else { crumb.className = 'current'; crumb.setAttribute('aria-current', 'location'); }
      $('breadcrumbs').append(crumb);
    });
  }

  function breakdownItems(node) {
    const children = node.children.length ? node.children : [node];
    return children.map(child => ({ node: child, cents: amount(child, state.from, state.to) }))
      .sort((a, b) => state.sort === 'name' ? a.node.name.localeCompare(b.node.name) : b.cents - a.cents);
  }

  function renderDonut(items, selectedNode) {
    const positiveItems = items.filter(item => item.cents > 0);
    const positiveTotal = positiveItems.reduce((sum, item) => sum + item.cents, 0);
    const negativeTotal = items.filter(item => item.cents < 0).reduce((sum, item) => sum + item.cents, 0);
    $('donut-count').textContent = positiveItems.length;
    $('donut-label').textContent = positiveItems.length === 1 ? 'positive category' : 'positive categories';
    $('donut-empty').hidden = positiveItems.length > 0;
    $('donut-empty').textContent = negativeTotal < 0 ? 'Only credits in this selection' : 'No posted expense amounts in this selection';
    $('credit-note').hidden = negativeTotal === 0;
    $('credit-note').textContent = `${money(negativeTotal)} in credits is included in net expenses. The donut shows positive category amounts only.`;
    $('chart-caption').textContent = selectedNode.children.length ? 'Select a slice or category to explore.' : 'Account detail · monthly amounts below.';
    donut.setOption({
      animation: !reducedMotion.matches, animationDuration: 320, animationDurationUpdate: 250,
      aria: { enabled: true, decal: { show: false } },
      tooltip: { trigger: 'item', confine: true, backgroundColor: '#101713', borderWidth: 0, textStyle: { color: '#fff', fontSize: 13 },
        formatter: params => `<strong>${html(params.name)}</strong><br>${money(params.data.cents)}<br>${(params.data.cents / positiveTotal * 100).toFixed(1)}% of positive amounts` },
      series: [{ type: 'pie', radius: ['60%', '83%'], center: ['50%', '50%'], padAngle: 1.5,
        minAngle: 0, stillShowZeroSum: false, label: { show: false }, labelLine: { show: false },
        itemStyle: { borderRadius: 3, borderColor: '#202623', borderWidth: 2 },
        emphasis: { scale: true, scaleSize: 7, itemStyle: { shadowBlur: 12, shadowColor: '#213e4620' } },
        data: positiveItems.map(item => ({ name: item.node.name, value: item.cents / 100, cents: item.cents, id: item.node.id,
          itemStyle: { color: item.node.color }, cursor: selectedNode.children.length ? 'pointer' : 'default' })) }]
    }, { notMerge: true });
    return { positiveTotal, negativeTotal };
  }

  function renderList(items, node, positiveTotal) {
    const inactiveCount = items.filter(item => item.cents === 0).length;
    const shown = items.filter(item => (state.inactive || item.cents !== 0) && item.node.name.toLowerCase().includes(state.search.toLowerCase()));
    $('category-list').replaceChildren();
    $('breakdown-title').textContent = node.children.length ? 'Expense categories' : 'Selected account';
    $('list-caption').textContent = node.children.length ? `${items.length} ${items.length === 1 ? 'category' : 'categories'} at this level` : 'Monthly totals from the source report';
    for (const item of shown) {
      const row = document.createElement(node.children.length ? 'button' : 'div');
      row.className = `category-row${item.cents < 0 ? ' negative' : ''}`;
      row.style.setProperty('--category-color', item.node.color);
      const share = item.cents > 0 && positiveTotal ? item.cents / positiveTotal * 100 : 0;
      row.style.setProperty('--category-width', `${share}%`);
      const detail = item.node.children.length ? `${item.node.children.length} ${item.node.children.length === 1 ? 'subcategory' : 'subcategories'}` : item.node.direct ? 'Posted directly to parent account' : 'Account detail';
      row.innerHTML = `<span><span class="category-name"><span class="color-dot" aria-hidden="true"></span><span>${html(item.node.name)}</span></span><span class="category-meta">${html(detail)}${node.children.length ? '<span>Explore</span>' : ''}</span><span class="category-bar" aria-hidden="true"><span></span></span></span><span class="amount">${money(item.cents)}</span><span class="share">${item.cents < 0 ? 'Credit' : item.cents === 0 ? '—' : `${share.toFixed(1)}%`}</span>`;
      if (node.children.length) {
        row.setAttribute('aria-label', `Explore ${item.node.name}, ${money(item.cents)}`);
        row.addEventListener('click', () => navigate(item.node.id));
        row.addEventListener('mouseenter', () => donut.dispatchAction({ type: 'highlight', name: item.node.name }));
        row.addEventListener('mouseleave', () => donut.dispatchAction({ type: 'downplay' }));
        row.addEventListener('focus', () => donut.dispatchAction({ type: 'highlight', name: item.node.name }));
        row.addEventListener('blur', () => donut.dispatchAction({ type: 'downplay' }));
      }
      $('category-list').append(row);
    }
    $('list-empty').hidden = shown.length > 0;
    $('list-empty').textContent = state.search ? 'No categories match this search.' : 'No active categories. Select Show inactive categories to inspect them.';
    $('hidden-count').textContent = !state.inactive && inactiveCount ? `${inactiveCount} inactive hidden` : '';
  }

  function renderTrend(node) {
    const indices = Array.from({ length: state.to - state.from + 1 }, (_, index) => index + state.from);
    const values = indices.map(index => ({ value: (node.values[index] ?? 0) / 100, cents: node.values[index] ?? 0,
      itemStyle: { color: (node.values[index] ?? 0) < 0 ? '#ffb3ab' : node.color ?? '#a6e9cb', opacity: /\d-\d/.test(report.months[index]) ? 0.58 : 1 } }));
    $('trend-title').textContent = node.children.length ? 'Monthly expenses' : 'Monthly account detail';
    $('trend-caption').textContent = `${node.name} · ${periodLabel()}${report.months.slice(state.from, state.to + 1).some(month => /\d-\d/.test(month)) ? ' · Partial months shown with lighter bars' : ''}`;
    trend.setOption({
      animation: !reducedMotion.matches, animationDuration: 300,
      aria: { enabled: true }, grid: { left: 8, right: 12, top: 24, bottom: 5, outerBoundsMode: 'same', containLabel: true },
      tooltip: { trigger: 'axis', confine: true, backgroundColor: '#101713', borderWidth: 0, textStyle: { color: '#fff', fontSize: 13 },
        formatter: params => `${html(report.months[indices[params[0].dataIndex]])}<br><strong>${money(params[0].data.cents)}</strong>` },
      xAxis: { type: 'category', data: indices.map(index => report.months[index].replace(/ 20\d\d$/, '')), axisTick: { show: false },
        axisLine: { lineStyle: { color: '#3b4841' } }, axisLabel: { color: '#a8bbb0', fontFamily: 'Segoe UI', fontSize: 12, interval: 'auto', hideOverlap: true } },
      yAxis: { type: 'value', axisLabel: { formatter: value => compactMoney(Math.round(value * 100)), color: '#a8bbb0', fontSize: 12 },
        splitLine: { lineStyle: { color: '#3b4841', type: 'dashed' } } },
      series: [{ name: node.name, type: 'bar', barMaxWidth: 48, itemStyle: { borderRadius: [4, 4, 0, 0] }, data: values }]
    }, { notMerge: true });
    const table = document.createElement('table');
    table.innerHTML = `<caption class="sr-only">Monthly amounts for ${html(node.name)}</caption><thead><tr><th scope="col">Source month</th><th scope="col">Amount (USD)</th></tr></thead><tbody>${indices.map(index => `<tr><th scope="row">${html(report.months[index])}</th><td>${money(node.values[index] ?? 0)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Selected period</th><td>${money(amount(node, state.from, state.to))}</td></tr></tfoot>`;
    $('monthly-table').replaceChildren(table);
  }

  function render() {
    const { root, node, path } = currentContext();
    $('from-month').value = state.from;
    $('to-month').value = state.to;
    $('scope').value = state.scope;
    const full = state.from === 0 && state.to === report.months.length - 1;
    $('full-period').classList.toggle('selected', full);
    $('full-period').setAttribute('aria-pressed', String(full));
    const lastIndex = lastFullMonth();
    $('last-full').disabled = lastIndex < 0;
    const isLast = state.from === lastIndex && state.to === lastIndex;
    $('last-full').classList.toggle('selected', isLast);
    $('last-full').setAttribute('aria-pressed', String(isLast));
    $('period-label').textContent = periodLabel();
    $('category-title').textContent = node.name;
    $('total').textContent = money(amount(node, state.from, state.to));
    $('scope-note').textContent = {
      expenses: 'Operating expenses from the P&L Expenses section. COGS and Other Expenses are excluded.',
      all: 'Includes the P&L Expenses, Cost of Goods Sold, and Other Expenses sections present in this report.',
      cogs: 'Cost of Goods Sold from the P&L. Includes wages where QuickBooks has classified them here.',
      other: 'Other Expenses from the P&L. Operating expenses and Cost of Goods Sold are excluded.'
    }[state.scope];
    const partialMonths = report.months.filter(month => /\d-\d/.test(month));
    panel.querySelector('.page-footer > span:last-child').textContent = partialMonths.length ? `Partial period: ${partialMonths.join(', ')}.` : 'Report values are not annualized.';
    renderBreadcrumbs(root, path);
    const items = breakdownItems(node);
    const totals = renderDonut(items, node);
    renderList(items, node, totals.positiveTotal);
    renderTrend(node);
    const leaves = flattenLeaves(node);
    $('leaf-count').textContent = `${leaves.length} ${leaves.length === 1 ? 'account entry' : 'account entries'} · Reconciled to source subtotals`;
    $('status').textContent = `${node.name}, ${periodLabel()}, net expenses ${money(amount(node, state.from, state.to))}.`;
  }

  function lastFullMonth() {
    for (let index = report.months.length - 1; index >= 0; index--) {
      if (!/\d-\d/.test(report.months[index])) return index;
    }
    return -1;
  }

  function resetPeriod() { state.from = 0; state.to = report.months.length - 1; }

  function exportView() {
    const { node } = currentContext();
    const indices = Array.from({ length: state.to - state.from + 1 }, (_, index) => index + state.from);
    const rows = [
      ['Company', report.company], ['Report', report.reportTitle], ['Source', report.fileName],
      ['Basis', report.basis], ['Scope', scopeRoot(report, state.scope).name], ['Selected category', node.name], ['Period', periodLabel()], [],
      ['Account path', 'Source CSV row', ...indices.map(index => report.months[index]), 'Selected total (USD)'],
      ...flattenLeaves(node).map(leaf => [leaf.path.join(' / '), leaf.sourceRow,
        ...indices.map(index => leaf.values[index] === null ? '' : leaf.values[index] / 100), amount(leaf, state.from, state.to) / 100]),
      ['Net expenses', '', ...indices.map(index => (node.values[index] ?? 0) / 100), amount(node, state.from, state.to) / 100]
    ];
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `Expense-Explorer-${state.from + 1}-${state.to + 1}.csv`;
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 30000);
    $('status').textContent = 'Current category and period exported, including its account detail.';
  }

  function showSource() {
    const { node } = currentContext();
    const fields = [['Company', report.company], ['Source file', report.fileName], ['Report period', report.period],
      ['Accounting basis', report.basis], ['Source timestamp', report.basisLine || 'Not supplied'], ['Current view', `${node.name} · ${periodLabel()}`],
      ['Source SHA-256', provenance.sha256 || 'Unavailable in this browser']];
    $('source-details').innerHTML = `<dl>${fields.map(([label, value]) => `<dt>${html(label)}</dt><dd>${html(value)}</dd>`).join('')}</dl>
      <div class="source-check">${report.checks.length} category and section totals match the monthly source controls.</div>
      <h3>How the numbers are read</h3><ul><li>Each account is counted once. Parent subtotals are controls, not extra expenses.</li><li>Amounts posted to a parent account appear as a “(direct)” entry alongside its subcategories.</li><li>Money is calculated in integer cents. Blank source cells remain blank in the account export and contribute no amount to report totals.</li><li>Negative amounts are credits. They reduce net expenses; the donut uses positive category amounts for its slices and percentages.</li><li>Month filters affect the total, donut, category list, monthly chart, and exported account detail. List search only narrows the category list.</li><li>Partial months retain the source label and are not annualized.</li></ul>
      <h3>What this file contains</h3><p>This export contains monthly P&amp;L account totals. It does not contain vendors, invoices, receipts, or individual transactions. Reconciliation checks validate the report structure and arithmetic; they do not verify the underlying books.</p>
      <h3>Using another export</h3><p>Choose Import P&amp;L CSV. A valid report replaces the current view. An invalid file leaves the current report intact. Imported data stays in this browser session and is not saved automatically. Reopening the app restores its bundled report.</p>
      <h3>Source preview for this view</h3><div class="table-scroll"><table><thead><tr><th scope="col">Account</th><th scope="col">Source row</th><th scope="col">Selected amount</th></tr></thead><tbody>${flattenLeaves(node).slice(0, 8).map(leaf => `<tr><th scope="row">${html(leaf.name)}</th><td>${leaf.sourceRow}</td><td>${money(amount(leaf, state.from, state.to))}</td></tr>`).join('')}</tbody></table></div><p>First ${Math.min(8, flattenLeaves(node).length)} account entries in the current category. Export current view for all account entries.</p>
      <h3>Chart library</h3><p>Apache ECharts ${html(chartVersion)}. Apache License 2.0. Distribution notices are included in this app folder.</p>`;
    $('source-dialog').showModal();
  }

  async function importFile(file) {
    if (!file) return;
    const operation = ++loadEpoch;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a CSV smaller than 5 MB.');
      const bytes = await file.arrayBuffer();
      const csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const nextReport = parseReport(csv, file.name);
      const hash = globalThis.crypto?.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('') : null;
      if (operation !== loadEpoch) return;
      installReport(nextReport, { sha256: hash });
      $('status').textContent = `Loaded ${file.name}; all category and section totals reconcile.`;
    } catch (error) {
      if (operation !== loadEpoch) return;
      $('message').textContent = `Could not import this report. ${error.message} Your current report is unchanged.`;
      $('message').hidden = false;
    } finally { $('file-input').value = ''; }
  }

  $('scope').addEventListener('change', event => { state.scope = event.target.value; state.path = []; state.search = ''; $('search').value = ''; render(); });
  $('from-month').addEventListener('change', event => { state.from = Number(event.target.value); if (state.to < state.from) state.to = state.from; render(); });
  $('to-month').addEventListener('change', event => { state.to = Number(event.target.value); if (state.from > state.to) state.from = state.to; render(); });
  $('full-period').addEventListener('click', () => { resetPeriod(); render(); });
  $('last-full').addEventListener('click', () => { const index = lastFullMonth(); if (index >= 0) { state.from = index; state.to = index; render(); } });
  $('reset-button').addEventListener('click', () => { state.scope = 'expenses'; state.path = []; state.search = ''; state.sort = 'amount'; state.inactive = false; resetPeriod(); $('search').value = ''; $('sort').value = 'amount'; $('inactive').checked = false; render(); });
  $('sort').addEventListener('change', event => { state.sort = event.target.value; render(); });
  $('search').addEventListener('input', event => { state.search = event.target.value; const { node } = currentContext(); const items = breakdownItems(node); renderList(items, node, items.filter(item => item.cents > 0).reduce((sum, item) => sum + item.cents, 0)); });
  $('inactive').addEventListener('change', event => { state.inactive = event.target.checked; render(); });
  $('table-button').addEventListener('click', () => { const show = $('monthly-table').hidden; $('monthly-table').hidden = !show; $('table-button').setAttribute('aria-expanded', String(show)); $('table-button').textContent = show ? 'Hide monthly values' : 'Show monthly values'; });
  $('export-button').addEventListener('click', exportView);
  $('source-button').addEventListener('click', showSource);
  $('close-source').addEventListener('click', () => $('source-dialog').close());
  $('source-dialog').addEventListener('click', event => { if (event.target === $('source-dialog')) { const bounds = event.target.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('source-dialog').close(); } });
  $('import-button').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', event => importFile(event.target.files[0]));
  const resize = new ResizeObserver(() => { donut?.resize(); trend?.resize(); });
  resize.observe($('donut')); resize.observe($('trend'));
  reducedMotion.addEventListener('change', () => { if (report) render(); });

  function loadReport(payload, operation) {
    if (operation !== undefined && operation !== loadEpoch) return false;
    const nextReport = parseReport(payload.csv, payload.fileName);
    if (operation === undefined) loadEpoch++;
    installReport(nextReport, payload);
    return true;
  }

  if (initial?.csv) loadReport(initial);
  else {
    for (const section of panel.querySelectorAll('[data-requires-report]')) section.hidden = true;
    $('empty-state').hidden = false;
    $('source-button').disabled = true;
    $('export-button').disabled = true;
  }

  return {
    beginLoad: () => ++loadEpoch,
    loadReport,
    chooseFile: () => $('file-input').click(),
    onShow: () => { donut?.resize(); trend?.resize(); },
  };
}
