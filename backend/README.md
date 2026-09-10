# LedgerFlow backend

This directory contains the Spring Boot API and SQLite persistence service.
Milestones 1 and 2 provide the schema, cookie authentication, password recovery,
company membership authorization, bootstrap, and user preferences. Ledger CRUD
is intentionally deferred to Milestone 3.

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

`PasswordResetNotifier` is the delivery boundary. The default implementation
records only that a request occurred and does not expose the token. Replace it
with an email provider implementation when deployment infrastructure is chosen.
