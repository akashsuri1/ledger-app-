# Backend Milestone 4 report

## 1. Files created

- `backend/src/main/java/com/ledgerflow/dashboard/DashboardService.java`
- `backend/src/main/java/com/ledgerflow/financial/FinancialRepository.java`
- `backend/src/main/java/com/ledgerflow/financial/FinancialCalculationService.java`
- `backend/src/main/java/com/ledgerflow/report/ReportService.java`
- `backend/src/main/java/com/ledgerflow/settings/CompanySettingsRepository.java`
- `backend/src/main/java/com/ledgerflow/settings/CompanySettingsService.java`
- `backend/src/main/java/com/ledgerflow/web/DashboardController.java`
- `backend/src/main/java/com/ledgerflow/web/CompanySettingsController.java`
- `backend/src/main/java/com/ledgerflow/web/ReportController.java`
- `backend/src/test/java/com/ledgerflow/Milestone4IntegrationTest.java`

## 2. Files modified

- `backend/README.md`
- `docs/BACKEND_HANDOFF.md`

The React frontend was inspected for response requirements and was not modified.

## 3. Flyway migration

No migration was required. The existing `company_settings`, ledger tables,
company-safe foreign keys, date-only values, integer amounts, and indexes already
support Milestone 4. V1 and V2 remain unchanged.

## 4. Dashboard API

`GET /api/companies/{companyId}/dashboard` returns Party/Transaction counts,
receivable, payable, net balance, recent Transactions, Region summaries, and six
calendar months of chart activity. Receivable and payable are split from final
Party balances. Recent rows use `transactionDate DESC, id DESC`; `recentLimit`
defaults to 5 and is constrained to 1-25.

The chart matches the existing frontend: the current month and preceding five
months, monthly CREDIT and DEBIT activity, deterministic `YYYY-MM` keys, English
short month labels, and zero-filled missing months.

## 5. Company Settings API

`GET|PATCH /api/companies/{companyId}/settings` uses the existing settings row.
The API covers statement header/footer, preset transaction limit, statement/print
booleans, A4 paper, portrait/landscape orientation, print font size, and custom
footer. Unsupported values and non-boolean switches return
`COMPANY_SETTINGS_INVALID`. Appearance stays user-scoped.

OWNER, ADMIN, and ACCOUNTANT may update settings. VIEWER may read only. Successful
changes write `COMPANY_SETTINGS_UPDATED` audit events.

## 6. Party Statement API

`GET /api/companies/{companyId}/reports/party-statement` accepts `partyId`, optional
inclusive `from`/`to`, and `limit`. Limits support `ALL` or 1-10,000, with the
Company default used when omitted. Last-N selects the newest eligible rows, then
returns them chronologically. Opening balance includes all history before the
first displayed row, including the same-date ID tie-breaker. Rows contain numeric
Credit/Debit columns and backend-calculated running balances.

## 7. Date-range API

`GET /api/companies/{companyId}/reports/date-range` accepts optional `partyId`,
`regionId`, `from`, and `to`. It returns chronological matching Transactions,
opening balance, period Credit/Debit, net movement, and closing balance. Both date
boundaries are inclusive. Results over 10,000 Transactions return a controlled
error so an accidental broad query cannot create an unbounded response.

## 8. Region Report API

`GET /api/companies/{companyId}/reports/regions` accepts optional `regionId`,
`from`, and `to`. Each Region includes Party/activity counts, period Credit/Debit,
opening/net/closing values, receivable/payable split from Party closing balances,
and Party breakdown rows. Empty Regions remain visible.

## 9. Financial calculation architecture

`FinancialRepository` performs company-scoped SQL counts, sums, date filtering,
monthly grouping, and per-Party period aggregation. `FinancialCalculationService`
owns sign and receivable/payable rules. `DashboardService` and `ReportService`
compose API views while controllers only parse routes and wrap responses.

Balances are always derived. Amounts remain Java `long` / SQLite `INTEGER`, and
Transaction dates remain Java `LocalDate` / API `YYYY-MM-DD`.

## 10. Authorization behavior

Every endpoint uses the existing active-membership authorization layer. All four
roles can read. Settings writes require OWNER, ADMIN, or ACCOUNTANT. Company and
resource IDs remain in every SQL predicate, and foreign Party/Region filters use
non-leaking not-found responses.

## 11. New error codes

- `COMPANY_SETTINGS_NOT_FOUND`
- `COMPANY_SETTINGS_INVALID`
- `INVALID_REPORT_LIMIT`
- `REPORT_TOO_LARGE`

Existing `INVALID_DATE_RANGE`, `PARTY_NOT_FOUND`, `REGION_NOT_FOUND`,
`COMPANY_ACCESS_DENIED`, `COMPANY_ROLE_FORBIDDEN`, and `VALIDATION_ERROR` are reused.

## 12. Tests added

Five integration scenarios cover empty and populated dashboards, Party-based
receivable/payable, recent ordering, chart grouping, settings defaults and every
role, appearance isolation, statement opening/running/closing balances, latest-N,
inclusive date reports, Region activity versus closing balances, viewer reads,
and cross-company Party/Region attacks.

## 13. Total tests passing

35 tests: 14 schema, 10 authentication/membership, 6 CRUD, and 5 Milestone 4
integration scenarios. Result: 35 passed, 0 failures, 0 errors, 0 skipped.

## 14. `mvn test`

Passed: 35 tests, 0 failures, 0 errors, 0 skipped.

## 15. `mvn package`

Passed. The executable Spring Boot JAR was produced at
`backend/target/ledgerflow-backend-0.0.1-SNAPSHOT.jar` (42,263,414 bytes).

## 16. Real HTTP smoke test

Passed against the packaged JAR on port 18081 and a fresh SQLite database. Flyway
successfully applied V1 and V2. The scenario fetched CSRF, registered, logged in,
created a Company/Region/Party, wrote a 25,000 CREDIT and 10,000 DEBIT, verified a
15,000 dashboard net and statement closing balance, updated/read Company Settings,
verified Region and Date Range Reports, and logged out. Final result: `SMOKE_OK`.

## 17. Frontend/report contract findings

- The frontend still calculates report models from LocalStorage and wraps rows as
  nested TypeScript transaction objects. The backend returns normalized report
  DTOs with Party/Region display fields included; the Milestone 7 typed client
  should replace or map the old client calculation types.
- The current Party Statement screen applies Last-N but does not pass date filters
  to its client calculator. The backend supports the specified optional inclusive
  `from`/`to` filters, so no backend limitation is introduced.
- The frontend date parser tolerates legacy datetime strings. The backend and
  schema intentionally accept only `YYYY-MM-DD`; a future LocalStorage import must
  normalize or reject legacy datetime values explicitly.
- The current Date Range UI selects one Party, all Parties in one Region, or all
  Parties. Accordingly, the endpoint exposes optional singular `partyId` and
  `regionId` filters.

## 18. Intentionally deferred

Attachment metadata in existing report UI remains empty until Milestone 5 adds
authorized file storage. Encrypted backup/restore, React API integration, broad
integration/recovery testing, and desktop packaging remain Milestones 6-9.

## 17. Frontend/backend discrepancy

The frontend Date Range filter represents its selected set as `partyIds`, while
the UI only permits a single Party or a whole Region. The backend exposes the
simpler equivalent `partyId` and `regionId` filters. The later integration layer
can send the selected Party directly or the selected Region without expanding it
into a client-side Party ID list.

Frontend report helpers still accept legacy datetime-shaped inputs for restored
LocalStorage data. Backend Transactions remain strictly date-only as required.

## 18. Intentionally deferred

Attachment storage, upload/download, encrypted backup/restore, LocalStorage
import, React API integration, integration/recovery hardening, and desktop
packaging remain separate later milestones. Milestone 4 stops here.
