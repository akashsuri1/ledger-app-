# LedgerFlow backend

This directory contains the Spring Boot API and SQLite persistence service.
Milestones 1 through 5 provide the schema, authentication, company authorization,
ledger CRUD, dashboard summaries, company settings, financial reports, and private
Transaction attachment storage.

## Requirements

- Java 23 (the project also remains within Spring Boot's supported Java range)
- Maven 3.6.3 or newer, or the included Maven wrapper once generated

## Database path

The default development database is:

```text
${user.home}/.ledgerflow/data/ledgerflow.db
```

Override it without changing source:

```powershell
$env:LEDGERFLOW_DATABASE_PATH = "C:\path\outside-OneDrive\ledgerflow.db"
```

SQLite foreign keys are enabled for every connection. The database is the live
application store; copying it into a synchronized directory is not the backup
strategy.

## Attachment storage

Attachments are stored beneath `${user.home}/.ledgerflow/data/attachments` by
default. Override the application data root with `LEDGERFLOW_DATA_DIR`. The
database stores only relative generated keys; files are never served as public
static resources.

The default limit is 10 MB and can be changed with
`LEDGERFLOW_ATTACHMENT_MAX_SIZE` (for example, `25MB`). Accepted formats are PDF,
PNG, JPG, and JPEG. LedgerFlow verifies the extension, supplied MIME type, and
file signature. One attachment is allowed per Transaction; another upload
replaces it.

## Commands

On this machine, Java is installed but is not currently on `PATH`, so set:

```powershell
$env:JAVA_HOME = "C:\Users\HP\.jdks\openjdk-23"
```

Then run:

```powershell
./mvnw.cmd test
./mvnw.cmd package
./mvnw.cmd spring-boot:run
```

Flyway owns the schema. Add a new migration for future changes; do not edit an
initial migration after it has been deployed.

## Authentication and CSRF

Authentication uses the `LF_SESSION` cookie. It contains a random opaque token,
is `HttpOnly`, and has a seven-day lifetime. SQLite contains only the token's
SHA-256 hash. Run with the `prod` profile, or set
`LEDGERFLOW_SECURE_COOKIES=true`, to require HTTPS for cookies.

Before any state-changing request, call `GET /api/auth/csrf`. This creates the
readable `XSRF-TOKEN` cookie. Send its value in the `X-XSRF-TOKEN` header. The
CSRF cookie must be readable because the SPA copies it into that header; it is
not an authentication credential. The `LF_SESSION` cookie remains unreadable to
JavaScript. Requests from the React app must include credentials.

Development CORS permits only `http://localhost:5173`. Override the comma-separated
origin list with `LEDGERFLOW_ALLOWED_ORIGINS`; credentialed wildcard origins are
not enabled.

Available Milestone 2 endpoints:

```text
GET  /api/auth/csrf
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/me/bootstrap
PATCH /api/me/preferences
```

Milestone 3 adds the core ledger resources:

```text
GET|POST              /api/companies
GET|PATCH|DELETE      /api/companies/{companyId}
GET|POST              /api/companies/{companyId}/regions
PATCH|DELETE          /api/companies/{companyId}/regions/{regionId}
GET|POST              /api/companies/{companyId}/parties
GET|PATCH|DELETE      /api/companies/{companyId}/parties/{partyId}
GET|POST              /api/companies/{companyId}/transactions
GET|PATCH|DELETE      /api/companies/{companyId}/transactions/{transactionId}
```

Party lists accept `search`, `regionId`, `page`, and `pageSize`. Transaction
lists also accept `partyId`, `type`, `from`, and `to`. Page sizes range from 1
through 100. Transaction dates are `YYYY-MM-DD`; amounts are positive integer
rupees. Every mutation requires the CSRF header described above.

Owners and admins may update company details, and only owners may delete an
empty company. Owners, admins, and accountants may mutate Regions, Parties, and
Transactions. Viewers have read-only access. All resource lookups and filters
are scoped to an active company membership.

Milestone 4 adds dashboard, settings, and reports:

```text
GET                  /api/companies/{companyId}/dashboard?recentLimit=5
GET|PATCH            /api/companies/{companyId}/settings
GET                  /api/companies/{companyId}/reports/party-statement
                     ?partyId=&from=&to=&limit=
GET                  /api/companies/{companyId}/reports/date-range
                     ?partyId=&regionId=&from=&to=
GET                  /api/companies/{companyId}/reports/regions
                     ?regionId=&from=&to=
```

Dashboard `recentLimit` defaults to 5 and accepts 1 through 25. Its chart contains
the current calendar month and preceding five months, with missing months filled
with zero credit and debit activity. Statement limits accept `ALL` or an integer
from 1 through 10,000; when omitted, the Company's default setting is used.
Report date boundaries are inclusive. Statement rows are selected newest-first
for Last-N and then returned in `transactionDate ASC, id ASC` display order.
Opening balances include history before the first displayed row. Date Range
reports reject results over 10,000 Transactions and require narrower filters.

All active roles may read dashboard, settings, and reports. Owners, admins, and
accountants may update Company Settings; viewers cannot. Appearance remains in
`/api/me/preferences` and is independent of Company Settings.

Milestone 5 adds Transaction attachments:

```text
POST   /api/companies/{companyId}/transactions/{transactionId}/attachment
GET    /api/companies/{companyId}/transactions/{transactionId}/attachment
DELETE /api/companies/{companyId}/transactions/{transactionId}/attachment
```

`POST` is multipart form data with a `file` part. OWNER, ADMIN, and ACCOUNTANT
may upload, replace, download, and delete. VIEWER may download only. Transaction,
dashboard, and report DTOs include nullable `attachment` metadata containing
`id`, `originalName`, `mimeType`, and `byteSize`; storage keys are private.
Deleting a Transaction or Party deletes attachment metadata in the same database
transaction and removes committed files after the transaction succeeds.

`PasswordResetNotifier` is the delivery boundary. The default implementation
records only that a request occurred and does not expose the token. Replace it
with an email provider implementation when deployment infrastructure is chosen.
