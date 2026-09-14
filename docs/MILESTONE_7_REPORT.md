# LedgerFlow Milestone 7 Report

Date: 2026-09-14  
Branch: `frontend-backend-integration`  
Status: Complete

## 1. Files created

- `frontend/.env.example`
- `frontend/scripts/integration-smoke.ts`
- `frontend/src/api/apiClient.ts`
- `frontend/src/api/authApi.ts`
- `frontend/src/api/companyApi.ts`
- `frontend/src/api/regionApi.ts`
- `frontend/src/api/partyApi.ts`
- `frontend/src/api/transactionApi.ts`
- `frontend/src/api/dashboardApi.ts`
- `frontend/src/api/settingsApi.ts`
- `frontend/src/api/reportApi.ts`
- `frontend/src/api/attachmentApi.ts`
- `frontend/src/api/backupApi.ts`
- `frontend/src/api/importApi.ts`
- `frontend/src/api/mappers.ts`
- `frontend/src/api/types.ts`
- `frontend/src/context/AuthProvider.tsx`
- `frontend/src/context/auth-context.ts`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/pages/Auth/AuthPages.tsx`
- `frontend/src/components/legacy/LegacyMigrationBanner.tsx`
- `frontend/src/utils/companyRouting.ts`
- `scripts/frontend-backend-smoke.ps1`
- `docs/MILESTONE_7_REPORT.md`

## 2. Files modified

The integration updated the root and frontend READMEs, frontend package scripts, application routing/bootstrap, Ledger and Settings contexts, company controls, layout/search/navigation, Dashboard widgets, Party/Region/Transaction screens and modals, Reports, Settings, Backup, domain types, confirmation handling, and the existing UI smoke test. No backend production source or desktop packaging source was changed.

## 3. API client design

`apiClient.ts` owns the configurable base URL, JSON and binary response handling, API envelope parsing, credentialed requests, query-string generation, normalized `ApiClientError` values, status handling, and `AbortSignal` support. Feature APIs are split into focused typed modules. `VITE_API_BASE_URL` defaults to `http://localhost:8080` for development and is documented in `.env.example`.

## 4. CSRF integration

Every mutation first refreshes `GET /api/auth/csrf`, reads the backend's `XSRF-TOKEN` cookie, and sends it as `X-XSRF-TOKEN`. Requests use `credentials: "include"`. CSRF remains enabled and no authentication token is stored in LocalStorage.

## 5. Authentication integration

`AuthProvider` uses the backend session and `/api/me/bootstrap` as its source of truth. It exposes login, registration, logout, password reset, preferences, and bootstrap refresh. A normalized 401 event clears authenticated state and returns the application to login.

## 6. Protected routes

Business routes render only after bootstrap establishes an authenticated user. Unauthenticated access redirects to `/login`, while the startup loading state prevents protected content from flashing before the session check completes.

## 7. Login/Register/Reset pages

The existing visual system now includes Login, Register, Forgot Password, and Reset Password screens. Register validates password confirmation and then follows backend registration/login behavior. Forms prevent duplicate submission and surface backend or network errors without exposing internals.

## 8. Bootstrap handling

Application startup calls `/api/me/bootstrap` and loads the user, accessible Companies, membership roles, and preferences. Logout clears server-backed frontend state while leaving legacy migration data intact.

## 9. 0/1/multiple Company routing

- Zero Companies: `/company-setup`
- One Company: selects it and enters `/dashboard`
- Multiple Companies: `/select-company`, unless a valid remembered Company is enabled

The first Company form creates a real backend Company whose creator becomes OWNER.

## 10. Company switch behavior

The switcher uses bootstrap Companies and roles. Switching immediately aborts old requests, clears Company-scoped state, selects the new Company, optionally persists `lastActiveCompanyId`, and loads the new Company's settings and ledger data.

## 11. LedgerContext migration strategy

The public LedgerContext operations remain recognizable but are asynchronous and API-backed. Context retains a bounded first page for shared selectors and legacy component compatibility; primary Party and Transaction tables use server filters and pagination, details fetch by ID, Dashboard and Reports use dedicated backend endpoints, and all mutations refresh backend state. LocalStorage is no longer the live ledger database.

## 12. Company integration

Accessible Company listing, create, update, switch, preference persistence, and empty Company deletion use backend APIs. Delete is offered only to the active OWNER when the visible Company is empty, and the backend remains authoritative through `COMPANY_NOT_EMPTY` and authorization checks.

## 13. Region integration

Region list/create/update/delete operations use backend endpoints. Existing normalized input, focus behavior, duplicate feedback, and protected-delete UX remain, with backend conflict codes supplying final authority.

## 14. Party integration

Party list, search, Region filter, pagination, create, edit, detail, balance, and cascade delete use backend data. The list is server-paginated; bookmarked Party detail URLs fetch directly by ID; statement-backed detail totals and transaction history avoid locally maintained balances.

## 15. Transaction integration

Transaction list/search/Party/Region/type/date filters and pagination run on the server. Create, edit, detail, delete, and bookmarked `?transaction=<id>` flows use typed endpoints. Mutation success refreshes Dashboard and shared Company data.

## 16. Dashboard integration

Dashboard cards, recent Transactions, chart series, and Region summaries use `GET /api/companies/{companyId}/dashboard`. The frontend formats the returned figures and does not calculate an independent Dashboard balance.

## 17. Settings integration

Company settings load and save through the Company settings API and change with the active Company. Company profile fields update through Company API for OWNER/ADMIN, settings are writable by backend writer roles, and global appearance preferences use `/api/me/preferences`.

## 18. Reports integration

Party Statement, date-range Report, and Region Report call backend report endpoints while preserving existing print layouts. Server results are keyed by Company and filter values so an older response cannot replace the current report. Browser/A4 rendering remains frontend-side.

## 19. Attachment integration

Transaction attachments support PDF, PNG, and JPEG upload, authorized Blob download with the original filename, replacement through the backend upload endpoint, and delete. Selected file bytes are never written to LocalStorage. Save controls remain disabled while uploads are pending.

## 20. Backup/Restore UI

OWNER-only backup accepts and confirms a passphrase, downloads the encrypted `.lfbak`, and clears the passphrase after success. Restore requires file and passphrase, performs backend preview, shows Company/count/warning/conflict information, and commits only as a new Company.

## 21. Legacy LocalStorage migration UI

Startup detects an existing LedgerFlow workspace and offers a review path. The Backup page sends the workspace to backend preview, displays counts, conflicts, and attachment filename warnings, then imports only after confirmation. Successful import refreshes bootstrap and marks migration complete while retaining the original LocalStorage copy.

## 22. Loading/error handling

Bootstrap, Company loads, server tables, direct detail requests, Reports, authentication forms, file operations, and mutations have loading/disabled or error states. API failures are normalized, general failures use existing messages/toasts, 401 clears authentication, and request keys prevent stale cross-request rendering. Confirmation dialogs now lock while asynchronous deletion is pending.

## 23. Role-aware UI

VIEWER users retain read access but do not receive create/edit/delete Transaction, Party, or Region controls. Company profile editing follows OWNER/ADMIN roles, backup/delete Company is OWNER-only, and the backend continues to enforce every permission.

## 24. Whole-rupee frontend changes

Transaction amount controls use `step="1"` and positive minimums. Submit handlers and LedgerContext reject decimal, unsafe, zero, and negative amounts before sending them. Values remain whole rupees and are not converted to paise.

## 25. Date-only handling

Transaction business dates remain `YYYY-MM-DD` strings from `input type="date"` through the typed API body. No time or timezone conversion is added. Entity `createdAt` timestamps remain distinct metadata.

## 26. Company cache/race protection

Company switching aborts the previous controller, increments a request generation, clears Company data immediately, and accepts responses only from the current generation. Table, search, direct-detail, and Report requests also use abort controllers or Company/filter request keys.

## 27. Frontend tests

`npm.cmd test` passed. Coverage includes workspace migration and isolation, routing rules, credentialed requests, CSRF behavior, normalized API errors, whole-rupee/date-only UI behavior, role controls, Company selection/deletion behavior, and page component rendering.

## 28. `npm run build` result

PASS — TypeScript project build and Vite production build completed successfully (`2459` modules transformed).

## 29. `npm run lint` result

PASS — ESLint completed with zero errors and zero warnings.

## 30. Backend regression test result

PASS — `mvn test` completed with 50 tests, 0 failures, and 0 errors. `mvn package` also completed successfully and produced the executable backend JAR. The backend source was unchanged by M7.

## 31. Real frontend/backend smoke result

PASS — `scripts/frontend-backend-smoke.ps1` started the packaged Spring Boot JAR and Vite against isolated ports/data, served LedgerFlow, and verified register/login, zero Companies, Company/Region/Party creation, ₹25,000 credit, ₹10,000 debit, ₹15,000 receivable balance, Transaction edit, Reports, PDF upload/download, encrypted backup preview/restore, restored data, preferences, logout/re-login, and bootstrap persistence.

Result: `FRONTEND_BACKEND_SMOKE_OK`

## 32. Legacy migration smoke result

PASS — representative legacy workspace data passed backend preview/commit, imported Companies/Regions/Parties/Transactions, retained a ₹5,000 balance, and left the original legacy source available.

Result: `LEGACY_IMPORT_UI_SMOKE_OK`

## 33. Intentionally deferred to M8

- Full browser-driven automation across every modal and recovery path; M7 uses component smoke tests plus a real packaged-backend/Vite integration smoke.
- Deeper adversarial security checks, interrupted upload/restore testing, corrupt backup matrices, browser refresh recovery, concurrent edit conflict UX, and extended network timeout/retry testing.
- Broader inline mapping of every backend `error.fields` entry; stable codes and messages are normalized now, with existing client field validation and general toast/form errors.
- Removal of legacy LocalStorage utilities and any deliberate cleanup/export policy. The old workspace remains retained for migration safety.

Desktop packaging was not started.
