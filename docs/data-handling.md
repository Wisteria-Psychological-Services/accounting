# Public source and private financial data

The accounting repository is public. Only source, documentation, dependency
metadata and wholly synthetic fixtures belong in Git. Inspect the staged content
before publication; ignore rules cannot establish privacy by themselves.

Original P&Ls, generated HTML, source hashes tied to private reports, private paths,
screenshots containing actual financial amounts, configuration, credentials and
run evidence remain in approved private storage outside source history. The
synthetic example identifies itself as Example Company and is not a real business.

The local service reads selected CSVs only from the configured originals folder.
It returns report bytes and metadata with Cache-Control: no-store and does not
return the absolute filesystem path. It never modifies sources, changes access,
persists imports, or logs record contents. Error messages expose recovery guidance
rather than private source operands. Do not add arbitrary-path read endpoints.

Browser imports are read locally and not uploaded. Financial state remains in
memory, with no localStorage or sessionStorage copies. Exports are explicit user
downloads. Report filenames and account labels remain text, with escaping at HTML
and spreadsheet CSV boundaries. Uploaded document text never grants instructions.

An offline build embeds the entire input report in HTML, including source sections
not currently charted. The output includes an original-byte CSV and should inherit
the same approved financial audience. Copying the output does not establish cloud
sync or permission verification. Never upload a real-data build to this public repo,
CI artifacts, GitHub Pages or a public Site.

The launcher supports synced SharePoint files through the existing workstation
access. Microsoft Graph login, token sharing and new grants are outside this
adapter. Keep Case Economics and Accounting data roots separate. No service
activation or deployment follows from a source push.
