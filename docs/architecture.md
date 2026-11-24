# Architecture and Case Economics alignment

Accounting follows the Case Economics web launcher conventions observed at
`8bfd119ac9a3cb495f75cdd455f1c87081c769c7`. That source supplies an architecture
and design reference. This independent public application contains no Case Economics
business engine, patient information, private configuration or Microsoft tokens.
The inspected documents and implementation hashes are recorded in
[alignment evidence](evidence/architecture-alignment.json).

## Responsibility boundaries

| Layer | Accounting owner | Case Economics convention |
| --- | --- | --- |
| Financial policy | `scripts/profit-and-loss/pnl.mjs` | Pure domain rules under `scripts/`, shared across callers |
| Local source adapter | `web/expenses.mjs` | Private originals folder, explicit input reads and source identity |
| HTTP boundary | `web/server.mjs` | Node 24, loopback default, route allowlist, same-origin checks, no-store, sanitized failures |
| App shell | `web/public/app.mjs`, `index.html` | Header, route navigation, `data-view`/`data-panel`, visible heading focus and browser history |
| Components and views | `web/public/components/`, `web/public/views/` | Browser-only UI separated from filesystem and HTTP service responsibilities |
| Presentation foundation | `web/public/shared/workbench.css` | Named `--ce-*` tokens, sage dark palette, Segoe UI, compact controls and panel geometry |
| Delivery and checks | Root scripts and `tests/` | Locked npm setup, focused domain/web checks, synthetic verification, private live data |

The shared workbench stylesheet owns the reusable shell, typography, controls,
navigation, panels and feedback states. Expense layout and chart styling stay in
the expense view stylesheet. The `ce-` class/token names intentionally retain the
reference vocabulary so the relationship is inspectable. No second palette is
maintained in each view. This is aligned source and conventions; Case Economics
does not currently consume Accounting as a package, and its source is unchanged.
A cross-repository package extraction would require its own consumers and scope.

## Runtime and data flow

1. `start:web` builds a local ECharts module and opens one loopback listener.
2. The shell mounts independent Expenses and Report files views. Navigation
   preserves the current in-memory report and filters and restores heading focus.
3. Report files lists ordinary CSV basenames in the private `originals` folder.
   Opening a selection is a read-only, no-store API request, with strict host and
   origin checks. There are no arbitrary filesystem paths supplied by the browser.
4. The adapter validates bounded original bytes, exact source identity and the
   domain report. It rejects changed reads, outside links and malformed reports.
5. The browser domain parser validates a full candidate before installing it.
   Report-load epochs and view request generations reject superseded responses.
6. Charts, details and exports derive from the same selected category and month
   range. No accounting decisions live in chart options, the server or templates.

Browser CSV imports remain entirely in memory and use the same parser. The offline
builder bundles the same shell, view, domain module, chart adapter and styles into
one HTML file. Offline navigation uses hashes and its folder picker explains the
available import path. Separate renderers or financial implementations are avoided.

## Source modes and security

The folder adapter supports ordinary local storage and OneDrive-synced SharePoint
storage. It relies on the workstation's existing file access and sync. It does not
reuse Case Economics' app registration or introduce direct Graph/OAuth behavior.
No fake Microsoft connection status or new authentication grants are shown.

All server responses are no-store, have nosniff and same-origin resource policy,
and prohibit framing. Scripts and assets are served from a fixed allowlist. The
chart library needs inline style updates, so style-src permits inline styles while
script-src and connect-src remain same-origin. The offline export has no network
access. There is no write API, LAN listener, service installation or credential
storage. See [data handling](data-handling.md) for the public-source boundary.
