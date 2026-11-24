# Expense exploration workflow

The operator wants to understand P&L expense composition. Begin with a complete
QuickBooks Profit and Loss by Month CSV and existing permission to its private
local or SharePoint-synced folder. Source classification, basis, partial periods
and monetary rules belong to [the data contract](data-contract.md).

## Open and explore

1. Start the loopback launcher using the [README setup](../README.md). No source
   data loads automatically. Choose Report files, select an existing CSV and Open
   report, or use Import P&L CSV directly in Expenses.
2. The app validates all monthly/Total rows and nested expense controls before
   replacing the current report. The initial view is operating expenses across
   the supplied report period. It does not claim that underlying books are closed.
3. Click a slice or its keyboard-accessible category row to drill into accounts.
   The category path returns to an ancestor. Direct postings stay visible alongside
   child accounts. A leaf account offers its monthly history rather than fabricated
   vendor or transaction detail.
4. Set inclusive months and expense scope. Net totals, donut, category list, monthly
   bars, details and exported account rows use the same financial selection. List
   search narrows only the category list. Show inactive categories reveals zero
   selected amounts. Credits keep their sign and partial months keep their labels.
5. Show monthly values for exact table amounts. Report details exposes original
   source identity, methods and a bounded source preview. Export current view
   downloads the selected leaf accounts and selected monthly observations.

Observable completion: the operator can reconcile the chosen total to its account
detail, identify large categories, inspect month changes and save the current
selection without changing the source. UI state is session-local, not an accounting
write or acceptance action. Leaving a view preserves that session's financial
selection; reloading the launcher starts with no private report loaded.

## Recovery and alternate inputs

- Missing data root or empty originals folder: the picker explains configuration
  or source availability; browser import remains available.
- Invalid or unreconciled CSV: show the error, retain the previous complete report
  and allow another selection. No partial candidate is installed.
- Source changed, removed, denied or not yet synced: show a recovery message and
  keep the previous browser report. Wait for saving/sync to finish, refresh the
  list and open the current file explicitly.
- Overlapping loads or navigation: later selections supersede earlier reads.
  Late responses cannot replace a newer report or redirect a hidden picker.
- Zero or all-credit selection: show explicit no-positive-expense chart feedback;
  signed net totals and account details remain available.
- Offline export: open the self-contained HTML in the synced folder. The bundled
  report is the default. Imported replacements last for that session. The Node-only
  source picker is disabled with import instructions, not a misleading empty list.

No source writes, financial approval, Graph permission changes, background
scheduling or unattended refresh is part of this workflow.

## Verification scenarios

| Requirement | Scenario and observable result | Evidence owner |
| --- | --- | --- |
| Exact account rollups | Nested/direct postings and signed credits reconcile by month | `tests/profit-and-loss/pnl.test.mjs` |
| Private input boundary | Traversal, oversize, outside links and malformed source are rejected | `tests/web/expenses.test.mjs` |
| Local HTTP boundary | Forged host, cross-site origin, mutation and unknown assets are denied | `tests/web/server.test.mjs` |
| End-to-end exploration | Open report, drill, select partial month, reset, table, source details and export | Browser checks in status/PR |
| Usable layout | Rendered desktop and 320px layout, native controls, keyboard activation and focus | Browser checks in status/PR |
| Recoverable source failure | Failed open keeps the last report and supports retry | Adapter tests and browser check |
| Same offline implementation | Synthetic standalone build opens without remote assets | Build plus served-output browser check |
