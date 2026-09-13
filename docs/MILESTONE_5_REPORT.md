# Backend Milestone 5 report

## Scope completed

Milestone 5 adds real, private file storage for one attachment per Transaction.
It includes upload, replacement, download, explicit deletion, cleanup after
Transaction or Party deletion, authorization, validation, audit events, response
metadata, configuration, database migration, and automated tests. No frontend,
desktop, backup/import, or later-milestone work is included.

## HTTP contract

```text
POST   /api/companies/{companyId}/transactions/{transactionId}/attachment
GET    /api/companies/{companyId}/transactions/{transactionId}/attachment
DELETE /api/companies/{companyId}/transactions/{transactionId}/attachment
```

POST accepts `multipart/form-data` with one `file` part and returns HTTP 201 with:

```json
{
  "data": {
    "id": 1,
    "originalName": "invoice.pdf",
    "mimeType": "application/pdf",
    "byteSize": 18432
  }
}
```

GET streams the file with verified `Content-Type`, `Content-Length`, a UTF-8
attachment `Content-Disposition`, `X-Content-Type-Options: nosniff`, and
`Cache-Control: no-store`. DELETE removes the attachment while retaining the
Transaction.

## Authorization and company isolation

OWNER, ADMIN, and ACCOUNTANT can upload, replace, download, and delete.
VIEWER can download only. Every operation first verifies active Company membership
and then performs a Company-scoped Transaction lookup. A Transaction ID from a
different Company returns the same unavailable response as an unknown ID.

## Validation

PDF, PNG, JPG, and JPEG are accepted. The service checks all three of extension,
reported MIME type, and magic-byte signature. Empty, mismatched, renamed, unsupported,
and oversized files receive stable API errors. The default maximum is 10 MB and is
configured by `LEDGERFLOW_ATTACHMENT_MAX_SIZE`.

Original filenames are reduced to a safe basename and control/header characters
are removed. Physical files use UUID names. Neither API metadata nor logs expose
absolute paths or original user-supplied paths.

## Storage and consistency

`LEDGERFLOW_DATA_DIR` controls the application data root. Files are stored beneath
its `attachments` directory with relative keys shaped like:

```text
companies/{companyId}/transactions/{transactionId}/{uuid}.{extension}
```

Writes stream through a bounded temporary file and move into place. Metadata is
written in a database transaction. If metadata or audit persistence fails, the new
file is removed as compensation. Replacement commits new metadata before removing
the previous file. Per-Transaction locking plus the database unique index prevents
concurrent requests from leaving multiple active attachment rows or files.

Transaction and Party deletion read the affected attachment metadata before the
cascade and register physical deletion after database commit. A rollback therefore
keeps the files. Physical cleanup failures are logged by a storage-key hash without
rolling back already-committed ledger changes.

## Schema and response changes

Flyway V3 adds a unique index on `(company_id, transaction_id)`. Existing initial
migrations were not edited. Transaction detail/list, dashboard recent rows, Party
Statement rows, and Date Range report rows now include nullable attachment metadata:
`id`, `originalName`, `mimeType`, and `byteSize`. `storageKey` remains server-only.

Audit actions are `ATTACHMENT_UPLOADED`, `ATTACHMENT_REPLACED`, and
`ATTACHMENT_DELETED`. Transaction and Party deletion audit metadata includes the
attachment count involved in the cascade.

## Stable attachment errors

- `ATTACHMENT_NOT_FOUND` — no metadata exists for the Transaction.
- `ATTACHMENT_TYPE_NOT_ALLOWED` — extension or MIME type is unsupported/mismatched.
- `ATTACHMENT_CONTENT_INVALID` — empty, unreadable, or signature-mismatched content.
- `ATTACHMENT_TOO_LARGE` — the configured limit is exceeded.
- `ATTACHMENT_FILE_MISSING` — metadata exists but its private file is unavailable.
- `ATTACHMENT_STORAGE_FAILED` — the private storage operation cannot complete.

Existing membership, role, transaction-not-found, malformed-request, and CSRF errors
are reused.

## Verification coverage

The M5 integration suite covers upload/download headers and bytes, filename safety,
private relative storage keys, response metadata, dashboard/report metadata,
replacement, explicit deletion, extension/MIME/signature/size rejection, all role
classes, cross-Company access, missing physical files, Transaction/Party cleanup,
database-failure compensation, concurrent replacement, audit events, and the V3
one-attachment database constraint.

## Final verification

`mvn package` passed with 44 tests, 0 failures, 0 errors, and 0 skipped. The
executable Spring Boot JAR was produced at
`backend/target/ledgerflow-backend-0.0.1-SNAPSHOT.jar` (42,298,120 bytes).

The real HTTP smoke ran against that packaged JAR on port 18083 with a fresh V3
SQLite database and private data directory. It fetched CSRF, registered and logged
in, created a Company/Region/Party/date-only Transaction, uploaded a PDF, verified
returned Transaction metadata, downloaded and byte-compared the PDF, verified the
`nosniff` header, explicitly deleted and re-uploaded the attachment, deleted the
Transaction, and confirmed physical cascade cleanup. Final result:
`ATTACHMENT_SMOKE_OK`.
