# LedgerFlow Milestone 8 Report

Milestone 8 hardens the existing web application. It adds no desktop packaging or unrelated product features. All destructive tests use temporary SQLite databases and temporary attachment directories.

## 1. Authorization matrix

`HardeningAuthorizationIntegrationTest` verifies every role against Company, Region, Party, Transaction, Dashboard, Reports, Settings, Attachment, Backup, Restore, and legacy-import operations.

| Capability | OWNER | ADMIN | ACCOUNTANT | VIEWER |
| --- | --- | --- | --- | --- |
| Read Company ledger, Dashboard, Reports, Settings, attachments | Yes | Yes | Yes | Yes |
| Update Company profile | Yes | Yes | No | No |
| Write Regions, Parties, Transactions, Settings, attachments | Yes | Yes | Yes | No |
| Delete Company | Yes, only while empty | No | No | No |
| Backup, restore, legacy import | Yes | No | No | No |

The backend remains authoritative when a client sends a forbidden mutation directly. Changing payload IDs or using stale frontend role data cannot grant access.

## 2. Cross-company attack tests

Two unrelated owners and Companies are used to probe foreign Company, Region, Party, Transaction, report-filter, Settings, Attachment, and Backup IDs. Nested foreign objects return `404` and do not disclose whether the object exists. Cross-Company relationships cannot be created.

## 3. Session security results

Tests cover valid, missing, malformed, expired, revoked, logged-out, rotated, and deleted-user sessions. Raw session values are never stored in SQLite. Logout and identity changes clear frontend authenticated state, active Company selection, and ledger state. A `401` stops protected rendering and returns the browser to login.

## 4. CSRF results

The hardening suite sends every authenticated mutation category without a token and verifies `403`: Company, Region, Party, Transaction, Settings, attachment upload/delete, Backup, Restore, import, and logout. CSRF remains enabled.

## 5. Company-switch race results

Company data loads now carry a request generation, an `AbortController`, and the expected Company ID. Dashboard, Regions, Parties, Transactions, Settings, Reports, and global search discard stale responses. The browser suite delays a source-Company response while switching through restored and empty Companies and confirms that source data never appears in the final Company.

The selected Company is stored in `sessionStorage` under the authenticated user ID. A direct refresh restores that tab's Company without sharing the selection with another user.

## 6. Concurrent mutation results

Company-scoped write locks serialize conflicting Region, Party, Transaction, Company-delete, and restore-name operations in this local single-process backend. Database uniqueness constraints still provide the final guarantee for normalized Region and Party names and GSTINs. Concurrent duplicate tests return stable conflict responses rather than SQL details. Company deletion rechecks emptiness while holding the Company lock. Transaction writes validate report aggregation inside the transaction and roll back on overflow.

The tested conflict model is first committed write wins. Later edit/delete/delete requests see the committed state and return a stable not-found or conflict response. This is suitable for M9's single local backend process.

## 7. Money and date hardening

Amounts must be positive whole rupees from `1` through `1,000,000,000,000`. The same limit is enforced in React, API validation, restore, and legacy import. Decimal, zero, negative, exponent-string, malformed, and over-limit values are rejected without rounding. Exact arithmetic and post-write aggregate checks prevent `long` wrapping.

Dates remain ISO `YYYY-MM-DD`. Tests include leap day, invalid calendar dates, equal and reversed report ranges, inclusive boundaries, create/update/list/report, encrypted round trip, and legacy import. No timezone conversion is applied to Transactions.

## 8. Attachment recovery results

Migration V4 adds a SHA-256 checksum to attachment metadata. Upload verifies the staged/final file before committing metadata; download detects missing, changed-size, and same-size corrupted files. Backup refuses corrupted physical attachments. Tests cover upload/replacement failure, unwritable staging, delete failure compensation, Transaction deletion, Party cascade cleanup, orphan-file tolerance, and cross-Company isolation. Existing attachment bytes remain intact after a failed replacement.

## 9. Backup/restore corruption and recovery results

Tests cover valid encrypted round trip, random encryption salts/nonces, wrong passphrase, ciphertext/header tampering, unsupported version, missing archive content, malformed manifest JSON, checksum changes, unsafe paths, excessive entries, expansion limits, missing/corrupted physical attachments, and failure during the restore transaction. Invalid input fails before permanent mutation. Injected restore failure rolls back database rows and removes staged files.

The non-trivial round trip preserves Regions, Parties, Credits/Debits, dates, Settings, PDF/PNG attachments, balances, Dashboard, statements, Region totals, and attachment bytes.

## 10. Legacy import hardening

Legacy preview/commit validation rejects malformed structure, unsupported formats, broken references, duplicate normalized values, decimal/negative/invalid amounts, invalid dates/types, and attachment names without bytes. Import is atomic. The original LocalStorage payload is retained. The browser marks a successful migration in LocalStorage so it does not prompt for the same migration again. A deliberate repeated backend import remains an owner-authorized restore-as-new operation.

## 11. Restart and persistence results

`scripts/m8-restart-smoke.ps1` runs the packaged JAR twice against one isolated application-data directory. The persisted session, Company, Region, Party, Transaction, balance, and exact attachment bytes survived restart. The check also proves that, when only `LEDGERFLOW_DATA_DIR` is supplied, SQLite is created at `<data-dir>/ledgerflow.db`.

Result: `M8_RESTART_PERSISTENCE_OK`.

## 12. Migration and fresh-install results

Fresh disposable databases apply V1 through V4 and pass foreign-key, schema, CRUD, cascade, and report checks. `DatabaseMigrationUpgradeTest` creates a version 3 database with existing Company, ledger, and attachment metadata, migrates it to V4, validates retained data and the new checksum constraint, then proves migration reruns are idempotent. Historical migrations were not edited.

## 13. Pagination and search edge tests

Parties and Transactions cover empty results, exact pages, final partial pages, beyond-last pages, invalid page/pageSize values, and the maximum page size. Page-count arithmetic is overflow safe. Search covers blank/whitespace, mixed data, literal `%` and `_`, Unicode, quotes, and an SQL-injection string without wildcard or injection behavior.

## 14. Accounting invariants

The test suite verifies statement closing balance equals opening plus Credit minus Debit, final running balance equals closing balance, Dashboard net equals receivable minus payable, Region totals agree with Party balances, and recalculation follows update/delete/cascade operations. Aggregate overflow causes the write to roll back.

## 15. Network failure UX

The browser suite injects a `503` during attachment upload after Transaction creation. The modal closes to prevent a duplicate Transaction retry, the UI reports that the Transaction was saved but the attachment was not, and the persisted balance remains correct. When all backend requests are refused, the app returns to login with a controlled backend-unavailable alert. It does not fall back to live LocalStorage persistence.

## 16. Production cookie and CORS review

Production-profile tests verify Secure, HttpOnly, SameSite=Lax, path, and expiry behavior. Credentialed CORS accepts only configured HTTP(S) origins, exposes `Content-Disposition` for attachment/backup filenames, and rejects wildcard, path-bearing, credential-bearing, query/fragment, blank, and unapproved origins. Security headers retain Spring Security's content-type and frame protections.

## 17. Secret and logging review

MVC body-render debug logging is suppressed so password/reset-token request bodies are not emitted. A scan of test logs found no fixture passwords, backup passphrases, raw session cookies, CSRF cookies, or reset tokens. Backup request objects do not render passphrases, and only hashed session/reset tokens are stored.

## 18. Configuration readiness for desktop

The backend has no developer-machine paths. M9 can configure:

- `VITE_API_BASE_URL`
- `LEDGERFLOW_DATA_DIR` and optional `LEDGERFLOW_DATABASE_PATH`
- `LEDGERFLOW_ATTACHMENT_MAX_SIZE`
- `LEDGERFLOW_ALLOWED_ORIGINS`
- `LEDGERFLOW_SECURE_COOKIES`
- multipart limits
- encrypted-backup size, entry, attachment, and PBKDF2 limits

`GET /api/health` performs a minimal database readiness query and returns only `{ "status": "UP" }`. It is public so a future desktop launcher can wait for Spring Boot without possessing a session.

## 19. E2E coverage

Playwright 1.63 runs against a packaged Spring Boot JAR, Vite, an isolated data directory, and Microsoft Edge. The three browser tests contain the eight required flows:

1. registration, first Company, and protected Dashboard;
2. Region, Party, Credit, Debit, and balance;
3. Party Statement and Region report mathematics;
4. PDF upload/download, PNG replacement, deletion, and restored-byte verification;
5. Company create/switch/isolation plus a delayed-response race;
6. encrypted backup and restore-as-new with Settings and attachments;
7. logout, protected-route blocking, login, and Company selection;
8. legacy preview/import and retained source data.

An additional recovery flow covers partial attachment failure and total backend unavailability. Accessible names and labels are exercised by role/label selectors throughout the suite.

## 20. Master E2E result

The real browser journey registers, creates Company/Region/Party data, records ₹25,000 Credit and ₹10,000 Debit, verifies ₹15,000, exercises attachments, Dashboard, Party Statement, Region report, changes Settings, creates and restores an encrypted backup, verifies restored data/settings/attachment bytes, switches Companies, logs out/in, imports legacy data, deletes a Transaction, verifies recalculation, deletes the Party, and verifies attachment cleanup.

Result: `M8_MASTER_E2E_OK`.

## 21. Recovery scenario result

The combined browser and backend recovery suites verify backend unavailability, expired/revoked sessions, partial attachment upload, wrong backup password, corrupted backup, invalid legacy import, restore rollback, filesystem failure, and a delayed Company switch. Assertions confirm no cross-Company overwrite and no permanent mixed state.

Result: `M8_RECOVERY_OK`.

## 22. Frontend quality gate

- `npm run build`: passed; 2,463 modules transformed.
- `npm run lint`: passed.
- `npm test`: passed; workspace, API integration, and rendered-page smoke suites.
- `npm run test:e2e`: passed; 3 browser tests containing all required flows.

## 23. Backend quality gate

- `mvn clean package`: passed.
- Tests: 65 passed, 0 failures, 0 errors, 0 skipped.
- Executable JAR: `ledgerflow-backend-0.0.1-SNAPSHOT.jar`.

## 24. Final known issues

No known critical or high-severity data-loss, authorization, or cross-Company isolation issue remains. The browser suite uses the installed Edge channel on Windows; M9 must choose and bundle the production desktop webview/runtime. Multi-process writes are outside the intended local single-backend topology; SQLite constraints remain authoritative if an accidental second process reaches the same database.

## 25. Deferred to M9

Electron/Tauri selection, desktop process lifecycle, app-data path selection, SPA asset hosting, Windows installer/registry integration, signing, autostart, auto-update, and runtime/webview packaging remain deferred. M8 does not start desktop packaging.
