# LedgerFlow backend milestone 1 report

## Result

Milestone 1 is complete. The repository now has separate `frontend`, `backend`,
`docs`, and reserved `desktop` directories. The backend starts, Flyway creates a
fresh SQLite database, all schema tests pass, and Maven produces an executable
Spring Boot jar.

No authentication endpoints, CRUD controllers, frontend API integration, file
storage, or backup services were implemented in this milestone.

## Runtime and build versions

- Java: OpenJDK 23 (installed at `C:\Users\HP\.jdks\openjdk-23`)
- Spring Boot: 4.1.1
- Maven wrapper: 3.9.12
- Maven wrapper plugin: 3.3.4
- Flyway: 13.5.0
- SQLite JDBC: 3.50.2.0

Spring Boot 4.1.1 supports Java 17 through Java 26. Java 23 was selected because it
is the JDK already installed on this machine.

## Dependencies

- Spring Web
- Spring Validation
- Spring JDBC / JdbcTemplate
- Spring Security, prepared for milestone 2
- Spring Boot Flyway starter
- Flyway SQLite database module
- Xerial SQLite JDBC driver
- Spring Boot test support
- Spring Security test support

JPA and Hibernate are not included.

## SQLite and Flyway configuration

The default database path is:

```text
${user.home}/.ledgerflow/data/ledgerflow.db
```

`LEDGERFLOW_DATABASE_PATH` overrides it. The default keeps the live database out
of the OneDrive repository. Tests use unique temporary database files.

Every connection enables SQLite foreign keys. Connections also use a five-second
busy timeout, WAL journal mode, and normal synchronous mode. Flyway migration
`V1__initial_schema.sql` is applied automatically at application startup.

## Schema

The initial migration creates:

1. `users`
2. `auth_sessions`
3. `companies`
4. `company_memberships`
5. `user_preferences`
6. `company_settings`
7. `regions`
8. `parties`
9. `transactions`
10. `transaction_attachments`
11. `audit_log`

The exact schema, constraints, and indexes are in
`backend/src/main/resources/db/migration/V1__initial_schema.sql`.

## Referential and deletion behavior

- Membership is unique on `(company_id, user_id)`.
- Region names are unique on `(company_id, normalized_name)`.
- Party names are unique on `(company_id, region_id, normalized_name)`.
- Non-empty party GSTIN values are unique inside a company.
- A party references its region with composite `(region_id, company_id)` integrity.
- A transaction references its party with composite `(party_id, company_id)` integrity.
- Attachment metadata references its transaction with composite
  `(transaction_id, company_id)` integrity.
- Region deletion is restricted while parties exist.
- Company deletion is restricted while ledger rows exist. Empty-company policy
  will also be checked in the service transaction in the CRUD milestone.
- Party deletion cascades to transactions, which cascade to attachment metadata.
- User session and membership support tables use deliberate ownership cascades.

Java service authorization will still verify membership and route ownership in
later milestones. Database constraints are the final defense against accidental
cross-company references.

## Whole-rupee and date enforcement

Transaction `amount` is an SQLite `INTEGER` with:

```sql
CHECK (typeof(amount) = 'integer' AND amount > 0)
```

This rejects zero, negative, and decimal amounts. Java APIs will use `Long`.
There is no paise conversion.

`transaction_date` is ISO `YYYY-MM-DD` text with a date-only database check. Java
APIs will use `LocalDate`; ledger dates will not receive timezone conversion.

## Tests

`DatabaseSchemaIntegrationTest` contains 14 integration tests covering:

- Spring application context startup;
- fresh SQLite database creation and Flyway V1 migration;
- repeat migration safety and data preservation;
- enabled SQLite foreign keys;
- same-company region uniqueness and cross-company allowance;
- cross-company region/party and party/transaction rejection;
- positive whole-rupee storage and decimal rejection;
- date-time rejection for ledger dates;
- protected region and populated-company deletion;
- party-to-transaction-to-attachment cascading;
- membership uniqueness;
- non-empty GSTIN uniqueness.

Verification results:

```text
Backend tests:  14 run, 0 failures, 0 errors, 0 skipped
Maven package:  BUILD SUCCESS
Startup check:  Spring Boot started, Flyway applied V1 to a clean SQLite database
Frontend tests: passed after moving to frontend/
Frontend lint:  passed
Frontend build: passed
```

Executable backend artifact:

```text
backend/target/ledgerflow-backend-0.0.1-SNAPSHOT.jar
```

## Decisions for review before milestone 2

1. Spring Security currently uses its generated development login because real
   authentication is explicitly milestone 2.
2. Integer IDs are retained to match the completed React types.
3. The database defaults to a per-user application-data directory suitable for a
   future desktop package.
4. Company settings and membership rows may cascade when an already-empty company
   is deleted; populated ledger rows restrict company deletion.
5. The new backend requirement is whole rupees. The existing frontend amount
   fields still use `step="0.01"` and accept decimals. They were left unchanged
   because milestone 1 prohibits frontend transaction changes. Before API
   integration, change both amount forms and context validation to positive
   integers so the UI matches the database.
6. SQLite is suitable for a local single-user desktop process. A hosted,
   concurrently written multi-user deployment should move to PostgreSQL through
   new migrations rather than stretching SQLite beyond that role.

