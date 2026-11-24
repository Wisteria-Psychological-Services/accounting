# Current implementation

## Initial expense explorer and Case Economics alignment

The expense explorer is prepared for publication to the accounting repository
from its initial main revision. The implementation follows the architecture and
design reference in [architecture.md](architecture.md), with exact revisions and
hashes in [evidence](evidence/architecture-alignment.json).

Implemented: Node 24 loopback launcher; modular Expenses and Report files views;
shared sage workbench styles; read-only private/synced-folder picker; unchanged
P&L policy module; category drill-down, inclusive months, expense scopes, credits,
monthly table, source details and CSV export; same-code offline packaging.

Validation performed:

- `npm test`: 17 passed, one skipped because creating symlinks requires an
  unavailable Windows privilege. No failures. Eight domain tests preserve the
  prior hierarchy, direct postings, cents, credits and reconciliation behavior.
- `npm run build:web`: passed with local chart assets.
- `npm run build:offline -- --input examples/profit-and-loss.csv --output dist/synthetic`:
  passed using wholly synthetic input.
- Browser: opened a selected synthetic folder report through the API, navigated
  between views, activated drill-down by keyboard, selected a partial month and
  checked signed credits. Replacing that source with an invalid CSV produced a
  visible error and preserved the category/month total. A zero report showed an
  explicit empty donut and exposed its inactive account on request.
- Browser: desktop and 320px reflow passed without horizontal page overflow. Search
  and clear restored all categories; combined expense scope and the monthly table
  matched the synthetic source. Source details showed the selected account preview.
  Back/forward navigation retained the report and filters. No console errors or
  warnings were observed in the final check. These are scoped browser checks,
  not a comprehensive accessibility or real-user acceptance claim.

Limits: direct Microsoft Graph authentication and live QuickBooks access are not
implemented; the folder adapter uses existing workstation/OneDrive access. No
production records were needed for this change's tests. The offline build passed,
but direct file launch cannot be exercised by the test browser because it denies
file URLs. No screen-reader or cross-browser audit is claimed. No merge, service
activation or new SharePoint deployment is part of this source publication.
