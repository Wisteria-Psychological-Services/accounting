import { api } from '../components/api.mjs';

export function mountReportFiles(root, { offline, explorer, showExpenses }) {
  const select = root.querySelector('#report-file');
  const open = root.querySelector('[data-open-report]');
  const refresh = root.querySelector('[data-refresh-reports]');
  const status = root.querySelector('[data-files-status]');
  const error = root.querySelector('[data-files-error]');
  const example = root.querySelector('[data-example]');
  let generation = 0, busy = false;

  function message(text = '') { error.textContent = text; error.hidden = !text; }
  function renderBusy() { open.disabled = busy || !select.value; refresh.disabled = busy || offline; select.disabled = busy || offline; example.disabled = busy || offline; }

  async function refreshFiles() {
    if (offline) {
      status.textContent = 'Offline export. Import another CSV for this session, or use the local launcher to choose synced report files.';
      renderBusy();
      return;
    }
    const operation = ++generation;
    busy = true; renderBusy(); message(); status.textContent = 'Loading report files…';
    try {
      const result = await api('/api/expenses/reports');
      if (operation !== generation) return;
      const previous = select.value;
      select.replaceChildren(new Option('Choose a report…', ''), ...result.files.map(file => new Option(file.name, file.name)));
      if (result.files.some(file => file.name === previous)) select.value = previous;
      status.textContent = !result.configured ? 'No report folder configured. Import a CSV, or set ACCOUNTING_DATA_ROOT on the launcher workstation.'
        : result.files.length ? `${result.files.length} report ${result.files.length === 1 ? 'file' : 'files'} available in the configured originals folder.`
          : 'No CSV reports found. Put a QuickBooks P&L export in the configured originals folder and refresh.';
    } catch (failure) { if (operation === generation) { message(failure.message); status.textContent = 'The previous file selection is retained.'; } }
    finally { if (operation === generation) { busy = false; renderBusy(); } }
  }

  async function openReport(route) {
    const operation = ++generation;
    const loadTicket = explorer.beginLoad();
    busy = true; renderBusy(); message(); status.textContent = 'Opening and validating report…';
    try {
      const payload = await api(route);
      if (operation !== generation) return;
      if (!explorer.loadReport(payload, loadTicket)) return;
      status.textContent = 'Report opened.';
      showExpenses();
    } catch (failure) { if (operation === generation) { message(failure.message); status.textContent = 'The current report is unchanged.'; } }
    finally { if (operation === generation) { busy = false; renderBusy(); } }
  }

  select.addEventListener('change', renderBusy);
  refresh.addEventListener('click', refreshFiles);
  open.addEventListener('click', () => openReport('/api/expenses/report?' + new URLSearchParams({ name: select.value })));
  root.querySelector('[data-import-file]').addEventListener('click', () => { explorer.chooseFile(); showExpenses(); });
  example.addEventListener('click', () => openReport('/api/expenses/example'));

  function setCurrent(metadata) {
    const panel = root.querySelector('[data-current-report]');
    panel.hidden = false;
    const list = panel.querySelector('dl');
    list.replaceChildren();
    for (const [label, value] of [['File', metadata.fileName], ['Company', metadata.company], ['Period', metadata.period], ['Basis', metadata.basis]]) {
      if (!value) continue;
      const term = document.createElement('dt'); term.textContent = label;
      const definition = document.createElement('dd'); definition.textContent = value;
      list.append(term, definition);
    }
  }

  return {
    setCurrent,
    onShow: refreshFiles,
    onHide: () => { generation++; busy = false; renderBusy(); },
  };
}
