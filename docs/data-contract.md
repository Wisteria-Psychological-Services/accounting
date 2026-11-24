# QuickBooks P&L expense data

The supplied QuickBooks Profit and Loss by Month CSV is the controlling source.
Support contiguous English monthly columns and a final Total column, with a
maximum of 36 months. Retain company, report title, original reporting period,
accounting basis, export timestamp, input filename, row locators, and SHA-256.
The report's accounting basis is reported, never changed by the app.

## Categories and reconciliation

The default scope is the source **Expenses** section, labeled Operating expenses.
Cost of Goods Sold and Other Expenses are independently selectable. All expenses
includes each present section once. Income, Other Income and profit measures are
excluded from expense composition.

QuickBooks' flat CSV has paired account headings and `Total for <account>` rows.
These define nested intervals. The section's `Total Expenses`,
`Total Cost of Goods Sold` or `Total Other Expenses` is its control row. An account
heading can contain direct amounts as well as subaccounts. Preserve those amounts
in a separately labeled `(direct)` entry. Never add subtotal controls as expenses.
Unpaired or overlapping category intervals are rejected instead of guessed.

Parse monetary observations into integer cents. A blank source cell remains null
and contributes no amount to the exported report's additive totals. Keep blank and
explicit zero distinct in account CSV exports. Validate every numeric source row
against its final Total and every expense group against each monthly subtotal.
Reject a malformed report before changing the current view. These checks establish
report arithmetic and structure, not that underlying accounting is complete.

## Visuals and controls

The selected category and inclusive month range govern net expenses, the donut,
breakdown, trend, source preview and exported account details. Scope changes reset
the category path. Search narrows only the adjacent category list; it does not
change the financial population. Inactive categories have zero selected net amount
and are hidden unless explicitly shown.

Signed credits reduce net expenses. A pie cannot represent negative area, so only
positive category amounts get slices. Shares use the sum of positive categories
at the current level; negative rows display Credit. A visible note explains any
negative categories omitted from that level's donut. Offsetting credits inside a
net-positive parent become visible when drilling into that parent. All-credit and
zero selections show explicit empty donut states. Trend bars preserve signs.

Partial month labels stay as exported. They use lighter bars plus explanatory text,
never extrapolation. Last full month chooses the latest source column without an
explicit partial-day range. Unknown source completeness remains unknown.

The export has no vendor or transaction observations, so the app never invents
vendor drill-down, invoice links or transaction data. CSV export includes leaf
account paths, source rows, selected monthly observations and totals. Escape
formula-like text labels before spreadsheet export.

## Data lifetime and destination

User-supplied CSV contents are untrusted data, not executable instructions. Escape
labels before HTML insertion. The build escapes closing script markup in embedded
input. The offline export's CSP disables network connections. The local launcher
permits same-origin API and chart assets only. All libraries are served locally;
the offline distribution includes their required license notices.

Browser imports are not uploaded, saved to localStorage, or written back to the
source. Imported reports last for the browser session. The launcher adapter reads
one selected CSV directly from ACCOUNTING_DATA_ROOT/originals and returns it with
no-store headers. It validates the source and rejects path traversal, linked
outside files, files larger than 5 MB, changed reads and malformed reports. Failed
loads preserve the last complete browser report. The launcher never writes source
files. Direct Graph access and Microsoft sign-in are not part of this adapter.

The offline HTML embeds the original report; keep it and the original-byte CSV
within the approved financial SharePoint audience. The public repository contains
source and wholly synthetic examples only. Do not commit real inputs or generated
financial artifacts.
