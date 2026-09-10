# Backend Milestone 3 report

## 1. Files created

- `backend/src/main/java/com/ledgerflow/common/InputValidator.java`
- `backend/src/main/java/com/ledgerflow/common/TextNormalizer.java`
- `backend/src/main/java/com/ledgerflow/company/CompanyRepository.java`
- `backend/src/main/java/com/ledgerflow/company/CompanyService.java`
- `backend/src/main/java/com/ledgerflow/region/RegionRepository.java`
- `backend/src/main/java/com/ledgerflow/region/RegionService.java`
- `backend/src/main/java/com/ledgerflow/party/PartyRepository.java`
- `backend/src/main/java/com/ledgerflow/party/PartyService.java`
- `backend/src/main/java/com/ledgerflow/transaction/TransactionRepository.java`
- `backend/src/main/java/com/ledgerflow/transaction/TransactionService.java`
- `backend/src/main/java/com/ledgerflow/transaction/TransactionType.java`
- `backend/src/main/java/com/ledgerflow/web/CompanyController.java`
- `backend/src/main/java/com/ledgerflow/web/RegionController.java`
- `backend/src/main/java/com/ledgerflow/web/PartyController.java`
- `backend/src/main/java/com/ledgerflow/web/TransactionController.java`
- `backend/src/main/java/com/ledgerflow/web/PagedEnvelope.java`
- `backend/src/test/java/com/ledgerflow/CrudIntegrationTest.java`

## 2. Files modified

- `backend/src/main/java/com/ledgerflow/auth/SecurityAuditRepository.java`
- `backend/src/main/java/com/ledgerflow/web/GlobalExceptionHandler.java`
- `backend/README.md`
- `docs/BACKEND_HANDOFF.md`

The React frontend was not changed.

## 3. Flyway migrations

No migration was needed. V1 already supplies the required tables, company-safe
composite foreign keys, uniqueness rules, delete behavior, integer amount check,
date-only check, and filter indexes. V1 and V2 remain unchanged.

## 4. Company API

Implemented list, create, get, patch, and delete. Creation atomically writes the
Company, creator's active `OWNER` membership, default Company Settings, and audit
event. Company names are normalized per accessible user rather than globally.
Only owners/admins may update. Only owners may delete, and the service checks
Regions, Parties, and Transactions inside the delete transaction. Dependency
races are returned as `409 COMPANY_NOT_EMPTY`.

## 5. Region API

Implemented list, create, patch, and delete. Names are whitespace/case normalized
and unique within a Company through service checks and the V1 database constraint.
Deletion is restricted while Parties exist and returns `409 REGION_NOT_EMPTY`.

## 6. Party API

Implemented paged list, create, detail, patch, and delete. Region ownership is
validated against the route Company. Normalized names are unique per
Company/Region; non-empty uppercase GSTIN values are unique per Company. Detail
and list rows derive current balance and transaction count without stored balance
columns.

## 7. Transaction API

Implemented paged list, create, detail, patch, and delete. Transactions may move
between Parties only inside the same Company. `TransactionType` is the enum
`CREDIT`/`DEBIT`, dates use `LocalDate`, and default ordering is
`transaction_date DESC, id DESC`.

## 8. Role and authorization enforcement

Every route invokes the Milestone 2 `CompanyAccessService`. Active membership is
required for reads. `OWNER`, `ADMIN`, and `ACCOUNTANT` may mutate ledger data;
`VIEWER` is read-only. Company details require owner/admin, and Company deletion
requires owner.

## 9. Cross-company protections

Repositories require both route `companyId` and resource ID. Party-to-Region and
Transaction-to-Party references are checked before writes and remain protected by
V1 composite foreign keys. Foreign Region, Party, and Transaction IDs return
non-leaking not-found errors and cannot be read, changed, moved, or deleted.

## 10. Search, filters, and pagination

Party search covers name, phone, GSTIN, address, notes, and Region name.
Transaction search covers Party name, description, and notes. Transaction filters
support Party, Region, type, and inclusive `from`/`to` dates. Search wildcards are
escaped. Paged responses contain `page`, `pageSize`, `total`, and `totalPages`;
page size is limited to 1–100.

## 11. Whole-rupee enforcement

The HTTP validator inspects the JSON number node and accepts only a positive
integer convertible to Java `long`. Zero, negative, decimal, missing, and
out-of-range amounts are rejected without rounding. SQLite's V1 `INTEGER` check
remains the final guard.

## 12. Party cascade deletion

Party deletion is transactional and company-scoped. The V1 foreign keys cascade
from the selected Party to its Transactions and attachment metadata. The service
records transaction/attachment counts before deletion. Other Parties, Companies,
and Transactions remain untouched; Region deletion still never cascades.

## 13. Stable error codes

The API adds/uses `COMPANY_ALREADY_EXISTS`, `COMPANY_NOT_EMPTY`,
`COMPANY_ACCESS_DENIED`, `REGION_NOT_FOUND`, `REGION_ALREADY_EXISTS`,
`REGION_NOT_EMPTY`, `PARTY_NOT_FOUND`, `PARTY_ALREADY_EXISTS`,
`PARTY_GSTIN_ALREADY_EXISTS`, `TRANSACTION_NOT_FOUND`,
`INVALID_TRANSACTION_TYPE`, `INVALID_DATE_RANGE`, `VALIDATION_ERROR`, and
`MALFORMED_REQUEST` through the existing error envelope.

## 14. Audit events

Company create/update/delete, Region delete, Party cascade delete, and Transaction
delete write company-aware events. Payloads contain IDs and cascade counts only;
no session tokens or sensitive request bodies are recorded.

## 15. Total tests

30 test methods: 14 schema, 10 authentication/membership, and 6 Milestone 3 CRUD
integration scenarios with detailed assertions across all specified domain rules.

## 16. `mvn test`

Passed: 30 tests, 0 failures, 0 errors, 0 skipped.

## 17. `mvn package`

Passed. The executable Spring Boot JAR was produced at
`backend/target/ledgerflow-backend-0.0.1-SNAPSHOT.jar` (42,194,498 bytes).

## 18. HTTP smoke test

Passed against the packaged JAR on port 18080 with a fresh SQLite database. The
test fetched a CSRF token, registered and logged in, confirmed the zero-company
bootstrap state, created a Company, Region, Party, CREDIT, and DEBIT, verified the
derived balance, exercised transaction search/pagination, updated and deleted
Transactions, cascade-deleted the Party and its remaining Transaction, confirmed
the Region remained, then deleted the Region, empty Company, and authenticated
session. Final result: `SMOKE_OK`, with zero Companies remaining.

## 19. Deferred to Milestone 4

Dashboard, Company Settings endpoints beyond atomic defaults, Reports,
attachments/files, backup/import, frontend API integration, and desktop packaging
remain deferred. The next backend milestone can build dashboard balances,
statement/report queries, and settings on the company authorization and CRUD
foundation completed here.
