# Accounting

A local webapp for exploring QuickBooks Profit and Loss by Month exports. Click
expense categories to drill into accounts, filter months, inspect signed credits,
and export the selected account detail. It uses Case Economics' Node.js launcher
architecture, modular browser views and dark sage workbench design conventions.

## Run locally

Use Node.js 24 and npm 11.19.1 from this repository:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run start:web
```

Open the printed loopback URL, normally `http://127.0.0.1:8790/expenses`.
**Import P&L CSV** loads a report for the current browser session. **Report files**
also offers an explicitly labeled synthetic example. There is no automatic
QuickBooks connection. Stop the local listener with Ctrl+C.

To choose files from an existing private or SharePoint-synced folder, put CSVs in
its `originals` subfolder, then start with:

```powershell
$env:ACCOUNTING_DATA_ROOT = 'C:\private\accounting'
$env:ACCOUNTING_WEB_PORT = '8790'
npm run start:web
```

Use your approved synced SharePoint folder in place of the example private path.
Choose **Report files**, select a P&L CSV, and **Open report**. **Refresh list**
reloads available names; opening a report reads its current bytes. A failed load
preserves the current report. The service never edits sources, creates a data
folder, changes permissions or exposes a LAN listener. Browser imports do not
upload files to the server. `Start Accounting.cmd` starts the same launcher after
dependencies and environment variables have been configured.

## Offline SharePoint-folder export

The same browser view and financial parser can be packaged as a self-contained
HTML app for an approved synced folder:

```powershell
npm run build:offline -- --input "C:\private\Profit and Loss by Month.csv" --output "C:\private\expense-app"
```

Open the output's `index.html` or **Start Expense Explorer.cmd** from the synced
folder. SharePoint's web file preview may download HTML instead of running it.
The offline export embeds the complete source report and chart library. Keep the
folder within the source report's approved audience and retain its license notices.
An imported replacement lasts for the browser session; rebuild to permanently
replace the bundled report. The folder-backed picker belongs to the Node launcher.

## Develop and verify

```powershell
npm test
npm run build:web
npm run build:offline -- --input examples/profit-and-loss.csv --output dist/synthetic
```

`npm run test:engine` checks financial parsing and reconciliation.
`npm run test:web` checks private file access and loopback HTTP boundaries.
Tests use synthetic data and temporary directories. The symlink test skips on
Windows when its required privilege is unavailable. `build:web` creates the local
ECharts module in ignored `.cache/`; `start:web` runs that build before listening.

| Task | Owner | Focused verification |
| --- | --- | --- |
| P&L classification, hierarchy, exact cents, scope | `scripts/profit-and-loss/pnl.mjs` | `test:engine` |
| Approved folder listing and source reads | `web/expenses.mjs` | `tests/web/expenses.test.mjs` |
| Routes, loopback origin, headers and asset allowlist | `web/server.mjs` | `tests/web/server.test.mjs` |
| Shell navigation and view lifecycle | `web/public/app.mjs` | Browser navigation and back/forward |
| Reusable workbench theme and controls | `web/public/shared/workbench.css` | Desktop and narrow rendered checks |
| Expense filters, charts, details and CSV export | `web/public/views/expense-explorer.mjs` | Browser workflow in `docs/workflows.md` |
| Report picker and failure recovery | `web/public/views/report-files.mjs` | Folder selection and failed-load recovery |
| Offline packaging and source hashes | `scripts/build-offline.mjs` | Synthetic build and served-output browser check |

For example, **Report files → Open report → Expenses** enters the report-files
view, requests one basename through `api.mjs`, and reaches `web/expenses.mjs`
through the server's fixed route. The adapter bounds and validates its read, then
the browser parser validates it before replacing the view. The domain module owns
all accounting decisions. View epochs discard superseded loads. The source CSV is
never modified. Follow [the documentation index](docs/README.md) for the relevant
architecture, financial, workflow and data-handling contract.

## Public-source boundary

This repository contains code, dependency metadata and wholly synthetic examples.
Real P&Ls, generated financial HTML, private configuration, credentials and run
evidence belong outside Git. See [data handling](docs/data-handling.md). All charts
use the free Apache ECharts library, bundled locally with distribution notices.
