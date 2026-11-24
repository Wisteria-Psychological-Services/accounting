import { mountExpenseExplorer } from './views/expense-explorer.mjs';
import { mountReportFiles } from './views/report-files.mjs';

const initial = JSON.parse(document.getElementById('initial-data').textContent);
const offline = initial.mode === 'offline';
const navigation = [...document.querySelectorAll('[data-view]')];
const panels = [...document.querySelectorAll('[data-panel]')];
const expenseRoot = document.querySelector('[data-panel="expenses"]');
let fileView;

const explorer = mountExpenseExplorer(expenseRoot, {
  initial,
  onLoaded: metadata => fileView?.setCurrent(metadata),
});
fileView = mountReportFiles(document.querySelector('[data-panel="report-files"]'), {
  offline,
  explorer,
  showExpenses: () => navigate('expenses'),
});
if (initial.csv) fileView.setCurrent({ fileName: initial.fileName, ...initial.summary });

function currentView() {
  const requested = offline ? location.hash.slice(1) : location.pathname.slice(1);
  return navigation.some(link => link.dataset.view === requested) ? requested : 'expenses';
}

function showView(focusHeading = false) {
  const view = currentView();
  for (const link of navigation) {
    if (link.dataset.view === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  for (const panel of panels) panel.hidden = panel.dataset.panel !== view;
  const visible = panels.find(panel => !panel.hidden);
  const heading = visible.querySelector('h1');
  document.title = `${heading.textContent} · Accounting`;
  if (focusHeading) heading.focus();
  if (view === 'expenses') { fileView.onHide(); explorer.onShow(); }
  else fileView.onShow();
}

function navigate(view) {
  const next = offline ? '#' + view : '/' + view;
  if (currentView() !== view) history.pushState(null, '', next);
  showView(true);
}

for (const link of navigation) {
  if (offline) link.href = '#' + link.dataset.view;
  link.addEventListener('click', event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(link.dataset.view);
  });
}
document.querySelector('[data-go-files]').addEventListener('click', event => { event.preventDefault(); navigate('report-files'); });
document.querySelector('[data-import-empty]').addEventListener('click', () => explorer.chooseFile());
window.addEventListener('popstate', () => showView(true));
window.addEventListener('hashchange', () => { if (offline) showView(true); });
document.querySelector('[data-source-mode]').textContent = offline ? 'Offline report · Browser session' : 'Local launcher · Private report files';
showView();
