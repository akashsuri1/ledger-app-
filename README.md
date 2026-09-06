# LedgerFlow

LedgerFlow is a local-first, multi-company business ledger frontend. It manages
regions, parties, credit/debit transactions, balances, reports, company-specific
statement and print settings, application preferences, and full-workspace backup and restore.

This repository currently contains the completed frontend only. Authentication,
Spring Boot APIs, and database persistence intentionally belong to the next
backend phase.

## Features

- Multiple isolated company workspaces with create, edit, and switch controls
- Company-scoped regions, parties, transactions, business identity, and reports
- Application-wide light, dark, or system theme and display preferences
- Dashboard totals, recent activity, charts, and regional summaries
- Party statements, date-range reports, and regional reports with print support
- Versioned and idempotent migration of existing single-company LocalStorage data
- Full LedgerFlow JSON backups with strict validation and two-step safe restore
- Party and transaction filtering and pagination
- Keyboard-accessible dialogs and graceful invalid-route handling
- Frontend-only persistence with explicit storage-health and recovery controls

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Vite prints the local development URL, normally `http://localhost:5173`.

## Quality checks

```bash
npm test
npm run lint
npm run build
```

`npm test` runs deterministic smoke tests for legacy migration, multi-company
isolation, referential validation, backup/restore round trips, backup history,
report calculations, pagination, and key page-component rendering. `npm run
build` writes the production application to `dist/`.

## Local data and migration

The canonical browser key is `ledgerflow-workspace`. Its version 1 envelope is:

```text
format: ledgerflow-workspace
version: 1
savedAt: ISO timestamp
data:
  companies
  activeCompanyId
  regions
  parties
  transactions
  applicationSettings.appearance
```

Business, statement, and print settings live on each company. Appearance stays
application-wide. Regions, parties, and transactions carry a `companyId`, and
validation rejects references that cross company boundaries.

On first launch after upgrading, LedgerFlow reads the former
`ledgerflow-data-v1` and `ledgerflow-settings` keys, creates one initial company,
assigns the existing ledger records to it, and writes the new canonical envelope.
The legacy keys are deliberately left untouched as migration inputs and are not
deleted.

If browser storage cannot be read safely, LedgerFlow protects the existing value
from automatic overwrite. Settings provides an explicit reviewed recovery action.

## Backup and restore

Backup files use the independent `ledgerflow-backup` version 1 JSON format and
contain the complete workspace for every company. Restore validates the envelope,
timestamps, entity IDs, duplicate rules, and all company/region/party references
before any data changes.

Restore is intentionally two-step: LedgerFlow first downloads a safety backup of
the current workspace, then asks the user to confirm that file is present before
persisting and activating the selected backup.

Backup JSON is not encrypted. It can contain company contact details, GSTINs,
ledger values, descriptions, and notes, so it should be stored privately.
Attachment filenames are included; attachment file contents are not.

## Production deployment

Build with `npm run build` and deploy the generated `dist/` directory. Because
LedgerFlow uses browser-history routes, static hosting must redirect unknown paths
to `index.html` so direct links such as `/reports` load correctly.

## Backend handoff

The next phase can replace the local persistence boundary with Spring Boot and a
database while retaining the current company-scoped domain model. Do not treat
LocalStorage company switching as authentication: users, passwords, roles,
authorization, auditing, server backups, and concurrency belong to the backend.
