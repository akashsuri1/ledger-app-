# LedgerFlow backend implementation handoff

## 1. Current application status

LedgerFlow has a complete frontend prototype built with React, TypeScript, Vite,
and Tailwind CSS. The frontend still persists its workspace in browser
LocalStorage until API integration. Backend Milestones 1 and 2 are complete:
SQLite/Flyway persistence, authentication, password recovery, memberships,
company authorization, bootstrap, and user preferences now exist. Milestone 3
also provides Company, Region, Party, and Transaction CRUD with server-side
search, filters, pagination, roles, and company isolation. Dashboard/report
APIs, object storage, and frontend API integration have not started.

The frontend already supports:

- multiple isolated companies;
- conditional company entry and company switching;
- regions, parties, credit/debit transactions, and balances;
- dashboard totals and recent activity;
- party statements, date-range reports, and region reports;
- company, statement, print, and application appearance settings;
- JSON backup, validation, and restore;
- transaction attachment selection (currently only the file name is persisted);
- guarded destructive actions and empty-company deletion.

Keep the public operations exposed by `LedgerContext` stable while replacing its
LocalStorage implementation with API calls. This minimizes page-level frontend
changes.

## 2. Authentication and company-entry behavior

After login, load only companies the authenticated user is allowed to access.

```text
0 companies  -> first-company setup
1 company    -> select it and open /dashboard
2+ companies -> open /select-company
```

Selecting a company sets the client-side `activeCompanyId`. Every API request must
still contain a company identifier and the server must verify membership. The
active company is a navigation preference, never an authorization boundary.

The first backend version can use:

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/me/bootstrap
PATCH /api/me/preferences
```

Recommended bootstrap response:

```json
{
  "data": {
    "user": {
      "id": 12,
      "name": "Aman Suri",
      "email": "aman@example.com"
    },
    "companies": [
      {
        "id": 41,
        "name": "ABC Enterprises",
        "address": "Ludhiana, Punjab",
        "phone": "9876543210",
        "gstin": "03ABCDE1234F1Z5",
        "email": "accounts@example.com",
        "role": "OWNER",
        "createdAt": "2026-09-09T10:00:00.000Z"
      }
    ],
    "preferences": {
      "rememberLastCompany": false,
      "lastActiveCompanyId": 41,
      "appearance": {
        "fontFamily": "inter",
        "baseFontSize": 16,
        "uiScale": 100,
        "density": "comfortable",
        "tableDensity": "normal",
        "accentColor": "blue",
        "theme": "light"
      }
    }
  }
}
```

When `rememberLastCompany` is enabled and the saved company is still authorized,
the frontend may open it directly. Otherwise, the count-based flow above applies.

Suggested roles:

| Role | Permissions |
| --- | --- |
| `OWNER` | Full ledger access, company settings, members, and company deletion |
| `ADMIN` | Full ledger access and member management, without deleting the company |
| `ACCOUNTANT` | Create and manage regions, parties, transactions, reports, and statement settings |
| `VIEWER` | Read dashboards, ledger data, and reports |

Prevent removal of the final owner. All authorization checks must run on the
server for every company-scoped endpoint.

## 3. Core data model

The frontend currently uses positive numeric IDs. Keeping integer IDs initially
avoids a broad frontend type migration. All timestamps are ISO 8601 UTC strings.
Transaction dates are calendar dates only.

### User and membership tables

```text
users
  id, name, email, password_hash, email_verified_at, created_at, updated_at

auth_sessions / refresh_tokens
  id, user_id, token_hash, expires_at, revoked_at, created_at

company_memberships
  company_id, user_id, role, status, created_at, updated_at
  UNIQUE(company_id, user_id)

user_preferences
  user_id, remember_last_company, last_active_company_id,
  appearance_json, updated_at
```

### Ledger tables

```text
companies
  id, name, normalized_name, address, phone, gstin, email,
  created_at, updated_at

company_settings
  company_id, statement_header, statement_footer,
  default_transaction_limit, show_running_balance, show_notes,
  show_attachment, show_business_address, show_business_phone,
  show_business_gstin, show_generated_date, show_page_numbers,
  paper_size, orientation, font_size, custom_footer, updated_at

regions
  id, company_id, name, normalized_name, created_at, updated_at
  UNIQUE(company_id, normalized_name)

parties
  id, company_id, region_id, name, normalized_name, phone,
  address, gstin, notes, created_at, updated_at
  UNIQUE(company_id, region_id, normalized_name)
  UNIQUE(company_id, gstin) where gstin is not empty

transactions
  id, company_id, party_id, type, amount, transaction_date,
  description, notes, created_at, updated_at

transaction_attachments
  id, transaction_id, storage_key, original_name, mime_type,
  byte_size, created_at
```

LedgerFlow supports whole Indian rupees only. Use SQLite `INTEGER` and Java
`Long` for transaction amounts, and return integer JSON numbers. Reject decimal
values rather than converting to paise or rounding. Do not use floating-point or
decimal columns for transaction amounts.
Use a SQL `DATE` for `transaction_date`, returning exactly `YYYY-MM-DD` without a
timezone. Use database constraints or service validation to guarantee that a
region, party, and transaction all belong to the same company.

## 4. Exact domain rules already enforced by the frontend

### Companies

- Company name is required and normalized for whitespace/capitalization.
- A user cannot create another accessible company with the same normalized name.
  Do not make names globally unique because unrelated users can own equally named
  businesses.
- Address, phone, GSTIN, and email are optional.
- A non-empty phone must contain exactly 10 digits.
- A non-empty email must be valid.
- GSTIN is trimmed and stored uppercase; the UI does not currently enforce a GSTIN
  pattern.
- New companies receive default statement and print settings.
- A company can be deleted only when it has zero regions, zero parties, and zero
  transactions. Recheck this inside the deletion transaction and return `409` if
  it is no longer empty.

### Regions

- Name is required.
- Region names are unique within a company after case/space normalization.
- A region cannot be deleted while it contains parties; return `409`.

### Parties

- Name and region are required.
- The selected region must belong to the same company.
- Party name is unique within its company and region after normalization.
- A non-empty GSTIN is unique within the company and stored uppercase.
- A non-empty phone must contain exactly 10 digits.
- Address and notes are optional.
- Deleting a party intentionally deletes all of that party's transactions. Do this
  atomically and delete associated attachment objects safely.

### Transactions

- `type` is exactly `CREDIT` or `DEBIT`.
- `partyId`, positive whole-rupee `amount`, `transactionDate`, and non-empty
  `description` are required.
- The party must belong to the route company.
- `transactionDate` is a valid `YYYY-MM-DD` calendar date. No time is accepted or
  displayed.
- Notes are optional.
- Current upload inputs accept PDF, JPG/JPEG, and PNG. The browser prototype only
  stores `attachmentName`; the backend must add actual upload, download, access
  control, size validation, and object deletion.

## 5. Accounting and report semantics

LedgerFlow uses these signs:

```text
CREDIT = +amount
DEBIT  = -amount
party balance = sum(credits) - sum(debits)
positive balance = receivable
negative balance = payable, displayed as absolute value
net balance = total receivable - total payable
```

All monetary calculations use whole rupees. Sort statement transactions by
`transactionDate ASC`, then a stable tie-breaker such as `id ASC`.

Date filters are inclusive. `from` and `to` use `YYYY-MM-DD`, and `from > to` is
invalid.

Party statements support `10`, `25`, `50`, `100`, `ALL`, or a custom positive
integer from 1 through 10,000. A Last-N statement selects the newest N eligible
transactions but returns them in chronological display order. Its opening balance
includes all earlier history before the first displayed row, so its closing
balance remains the party's true balance.

For date-range and region reports:

- `totalCredit` and `totalDebit` describe activity inside the selected period;
- `openingBalance` includes history before `from`;
- `netMovement = totalCredit - totalDebit`;
- `closingBalance = openingBalance + netMovement`;
- region receivable/payable values use party closing balances, including history.

The existing TypeScript report calculations can remain client-side for the first
API integration. Server-side report endpoints are preferable once datasets grow.

## 6. REST API contract

Use a consistent success envelope:

```json
{
  "data": {},
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 118,
    "totalPages": 5
  }
}
```

Use a consistent error envelope:

```json
{
  "error": {
    "code": "REGION_NOT_EMPTY",
    "message": "This region contains parties. Move or delete those parties first.",
    "fields": {}
  }
}
```

Recommended status codes are `400` for malformed input, `401` for unauthenticated,
`403` for insufficient role, `404` for inaccessible or missing company resources,
`409` for uniqueness/deletion conflicts, `422` for field validation, and `429` for
rate limits.

### Companies and memberships

```http
GET    /api/companies
POST   /api/companies
GET    /api/companies/:companyId
PATCH  /api/companies/:companyId
DELETE /api/companies/:companyId

GET    /api/companies/:companyId/members
POST   /api/companies/:companyId/invitations
PATCH  /api/companies/:companyId/members/:userId
DELETE /api/companies/:companyId/members/:userId
```

Creating a company must also create an `OWNER` membership and default settings in
one database transaction.

### Company settings

```http
GET   /api/companies/:companyId/settings
PATCH /api/companies/:companyId/settings
```

### Regions

```http
GET    /api/companies/:companyId/regions
POST   /api/companies/:companyId/regions
PATCH  /api/companies/:companyId/regions/:regionId
DELETE /api/companies/:companyId/regions/:regionId
```

### Parties

```http
GET    /api/companies/:companyId/parties?search=&regionId=&page=1&pageSize=25
POST   /api/companies/:companyId/parties
GET    /api/companies/:companyId/parties/:partyId
PATCH  /api/companies/:companyId/parties/:partyId
DELETE /api/companies/:companyId/parties/:partyId
```

The party detail response may include its calculated balance and transaction count
to avoid downloading all transactions.

### Transactions and attachments

```http
GET    /api/companies/:companyId/transactions
       ?search=&partyId=&regionId=&type=&from=&to=&page=1&pageSize=25
POST   /api/companies/:companyId/transactions
GET    /api/companies/:companyId/transactions/:transactionId
PATCH  /api/companies/:companyId/transactions/:transactionId
DELETE /api/companies/:companyId/transactions/:transactionId

POST   /api/companies/:companyId/transactions/:transactionId/attachment
GET    /api/companies/:companyId/transactions/:transactionId/attachment
DELETE /api/companies/:companyId/transactions/:transactionId/attachment
```

Transaction request/response example:

```json
{
  "partyId": 81,
  "type": "CREDIT",
  "amount": 12500,
  "transactionDate": "2026-09-09",
  "description": "Invoice LF-104",
  "notes": "September supply"
}
```

### Dashboard and reports

```http
GET /api/companies/:companyId/dashboard?recentLimit=5
GET /api/companies/:companyId/reports/party-statement
    ?partyId=&from=&to=&limit=25
GET /api/companies/:companyId/reports/date-range
    ?partyIds=1,2&from=&to=
GET /api/companies/:companyId/reports/regions
    ?regionId=&from=&to=
```

Dashboard data should contain party count, transaction count, total receivable,
total payable, net balance, recent transactions, and the time-series data required
by the existing balance chart.

### Backup and migration

```http
GET  /api/export
GET  /api/companies/:companyId/export
POST /api/import/preview
POST /api/import/commit
```

The current backup is a full multi-company workspace. A backend import must verify
ownership, all foreign-key relationships, duplicate IDs, valid calendar dates,
supported enum/settings values, and backup version before writing. Preview first,
then commit atomically. Never allow imported `companyId` values to bypass current
user authorization.

For existing browser users, provide a one-time “Move local data to account” flow.
The frontend can read its current LocalStorage workspace, upload it for preview,
then commit after confirmation. Keep the local backup until the server confirms a
successful import.

## 7. Frontend integration plan

1. Add an auth provider and protected routes.
2. Add a typed API client with credential refresh and normalized API errors.
3. Load `/api/me/bootstrap` before rendering the app.
4. Preserve `LedgerContext` method names, but make mutations asynchronous and
   update/query cached server state.
5. Replace global LocalStorage workspace persistence with API resources. Appearance
   preferences may be cached locally for immediate startup.
6. Keep `activeCompanyId` in context and include it in every ledger query key.
7. Clear old-company cached data immediately when switching companies.
8. Wire real attachment uploads and authorized downloads.
9. Add the local-data import flow before removing legacy LocalStorage support.
10. Display membership role on `/select-company` once the bootstrap API supplies it.

The frontend currently expects numeric IDs. If the backend chooses UUIDs, update
all entity IDs, route parsing, filters, backup validation, and context method
signatures together.

## 8. Security and consistency requirements

- Hash passwords with Argon2id or bcrypt using current secure parameters.
- Prefer short-lived access tokens plus rotated refresh tokens in secure,
  HttpOnly, SameSite cookies, or a secure server session.
- Add CSRF protection when cookie authentication can be sent cross-site.
- Rate-limit login, password reset, invitation, import, and upload endpoints.
- Normalize and validate every request server-side.
- Check company membership in the same service/repository layer used by every
  query and mutation.
- Do not reveal whether an unauthorized company or nested resource exists; return
  `404` where appropriate.
- Validate upload MIME type, extension, size, and file signature. Store objects
  outside the public web root and authorize every download.
- Wrap cascade deletes, company creation, imports, and membership changes in
  database transactions.
- Add database indexes for every foreign key and for transaction filtering:
  `(company_id, transaction_date, id)`, `(company_id, party_id,
  transaction_date, id)`, and party/region lookup columns.
- Record destructive actions and membership changes in an audit log.

## 9. Backend acceptance criteria

- A user can register, log in, refresh a session, log out, and recover access.
- Users see only companies where they have an active membership.
- The zero/one/multiple-company routing rules work after every authenticated
  bootstrap.
- Data from one company can never be read or modified through another company's
  route.
- Company, region, party, and transaction validations match this document.
- Empty-company, protected-region, party-cascade, and transaction deletions are
  atomic and return stable error codes.
- Date-only values survive create, update, filtering, export, and import unchanged.
- Dashboard and report totals match the accounting equations above.
- Pagination and filters return deterministic ordering and accurate totals.
- Attachments are stored, authorized, downloaded, replaced, and deleted correctly.
- Existing browser data can be previewed and imported without silent loss.
- API integration tests cover role access, cross-company access attempts,
  uniqueness races, deletion races, date boundaries, and balance calculations.

## 10. Frontend source-of-truth files

- `frontend/src/types/index.ts` — company, region, party, and transaction shapes
- `frontend/src/types/settings.ts` — company print and user appearance settings
- `frontend/src/context/LedgerContext.tsx` — current mutations and validation behavior
- `frontend/src/utils/ledgerMutations.ts` — cascade and empty-company deletion rules
- `frontend/src/utils/reportCalculations.ts` — balance and report semantics
- `frontend/src/utils/workspaceStorage.ts` — current workspace validation and legacy migration
- `frontend/src/utils/backup.ts` — backup envelope, preview, history, and restore behavior
- `frontend/src/App.tsx` — conditional company-entry routing
- `frontend/src/pages/CompanySelection/CompanySelection.tsx` — multiple-company selection UI
