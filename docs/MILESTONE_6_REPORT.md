# Backend Milestone 6 report

## 1. Files created

Milestone 6 adds the `backend/src/main/java/com/ledgerflow/backup` package with
configuration, models, encryption, archive processing, snapshot creation, full
validation, Company locking, restore writing, and legacy parsing/import services.
It also adds `BackupController`, `LegacyImportController`,
`Milestone6IntegrationTest`, and the repeatable
`backend/scripts/backup-restore-smoke.ps1` packaged-JAR smoke test.

## 2. Files modified

The attachment validator now supports validated in-memory restore bytes. Attachment
upload plus Transaction and Party cascade deletion participate in the Company
operation lock. Membership queries support restore authorization. Multipart and
backup limits were added to `application.yml`; oversized restore requests now use
the backup error code. `backend/README.md` and `docs/BACKEND_HANDOFF.md` document
the completed contract. No frontend or desktop source was changed.

## 3. Flyway migration

No migration was needed. The logical backup and restore use the existing Flyway
V1-V3 schema and the existing private attachment store.

## 4. Backup scope

The implemented unit is one Company. It contains business details, all current
Company statement/print Settings, Regions, Parties, Transactions, attachment
metadata, and attachment bytes. It excludes users, credentials, sessions, reset
tokens, memberships, unrelated Companies, storage paths, and audit internals.

## 5. `.lfbak` format

The encrypted file has a LedgerFlow binary header followed by AES-GCM ciphertext.
The decrypted payload is a ZIP containing `manifest.json`, `company.json`, and
`attachments/*.bin`. Manifest `formatVersion` is 1 and is independent of Flyway.
It includes creation/application metadata, scope and counts, and SHA-256 digests
for every logical content entry.

## 6. Encryption algorithm

The entire logical archive is encrypted with JDK `AES/GCM/NoPadding` using a
256-bit key and a 128-bit authentication tag. The header is supplied as GCM
additional authenticated data, so changing its supported metadata invalidates
authentication. No custom cipher or ZIP password encryption is used.

## 7. KDF and parameters

The key uses `PBKDF2WithHmacSHA256`, a 256-bit derived key, and 310,000 iterations
by default. PBKDF2 was chosen as the documented fallback because it is provided by
the target JDK and avoids adding a native or third-party Argon2 provider. Restore
accepts only bounded iteration counts; tests use the minimum 100,000 for speed.

## 8. Salt and nonce handling

Every encryption generates a cryptographically random 32-byte salt and a separate
random 12-byte GCM nonce with `SecureRandom`. Neither value is reused or treated as
secret. Key, salt, nonce, passphrase arrays, plaintext ZIP bytes, and snapshot file
byte arrays are cleared when their operation finishes where Java permits.

## 9. Authorization

Only an active OWNER can export a Company. Restore and legacy import are available
to a user who owns at least one active accessible Company. A user with zero
memberships may restore/import their first Company. Users whose memberships are
only ADMIN, ACCOUNTANT, or VIEWER are denied. Inaccessible Company backups return
the normal company-scoped unavailable response.

## 10. Backup consistency and locking

Backup holds a fair, Company-scoped lock while reading one SQLite transactional
snapshot and all referenced attachment bytes. Attachment upload/replacement and
Transaction/Party deletion use the same lock through transaction completion. This
prevents metadata/file disagreement without blocking unrelated Companies.

## 11. Restore preview architecture

`POST /api/backups/restore/preview` is stateless. It reads the encrypted multipart
file, authenticates/decrypts it, safely inspects the archive, validates every
record and attachment, calculates counts, and reports name conflicts. It writes no
database or filesystem state. Commit reuploads and revalidates the file and
passphrase; no decrypted archive, passphrase, or preview token is retained.

## 12. Restore modes

M6 implements `RESTORE_AS_NEW`. Commit accepts an optional non-conflicting
`companyName`, creates a new Company, assigns the current user as OWNER, and leaves
existing Companies untouched. Numeric source IDs are never inserted directly.

## 13. Pre-restore recovery

There is no destructive replacement mode in M6, so a pre-replacement recovery
snapshot is neither required nor created. `REPLACE_EXISTING` and its encrypted
pre-restore recovery file are intentionally deferred until they can be implemented
with an explicit target and fully safe directory swap.

## 14. Database/filesystem consistency

All validation completes before mutation. Restore then creates Company, membership,
Settings, Regions, Parties, Transactions, attachment metadata, and its audit event
inside one database transaction. Each attachment streams through the M5 bounded
temporary-file implementation and is atomically moved to a generated private key.
If any later file, row, audit, or commit operation fails, SQLite rolls back and the
restore writer deletes every new physical file as compensation. Injected-failure
testing confirms zero new Company rows and zero orphan files.

## 15. ID remapping

Restore builds old-to-new Region and Party maps and uses the new generated
Transaction IDs for attachment storage. Legacy import does the same independently
for every imported Company. Imported IDs only express relationships and cannot
select or authorize an existing server record.

## 16. Attachment integrity

Backup fails if attachment metadata references a missing or size-mismatched stored
file. The manifest and per-attachment metadata carry SHA-256 digests. Restore
checks presence, count, size, and digest, then revalidates safe filename,
extension, MIME type, maximum individual size, and PDF/PNG/JPEG magic bytes before
writing. Restored download bytes are checked exactly in integration and HTTP smoke
tests.

## 17. Archive protections

Archive entries are processed in memory and never extracted to archive-controlled
paths. The reader rejects NULs, backslashes, absolute paths, Windows drive paths,
empty/dot/dot-dot components, unsupported roots, directories, and duplicate names.
The manifest must exactly match the content-entry set and digests. Tests cover
`../../ledgerflow.db`, Windows traversal, Unix absolute, and drive-letter paths.

## 18. Resource limits

Defaults are 256 MB encrypted input, 512 MB total uncompressed content, 10,000 ZIP
entries, 5,000 attachments, and the existing 10 MB maximum for each attachment.
All are configurable. Reads are bounded while streaming; overflow, entry floods,
and compressed expansion return `BACKUP_TOO_LARGE` before mutation.

## 19. Legacy browser import

`POST /api/import/legacy/preview` and `/commit` accept the real frontend's direct
workspace, `ledgerflow-workspace` version-1 envelope, or `ledgerflow-backup`
version-1 envelope. Parsing validates all arrays, IDs, references, normalized
duplicates, Settings, dates, types, and positive whole-rupee integer amounts.
Commit imports all Companies as new owned Companies in one transaction and carries
forward the application appearance JSON.

## 20. Legacy attachment names

An old `attachmentName` produces a preview and commit warning. Its Transaction is
preserved, and no attachment row or placeholder file is created because the
browser format did not contain the original bytes.

## 21. Error codes

M6 adds or uses `BACKUP_PASSWORD_INVALID`, `BACKUP_CORRUPTED`,
`BACKUP_VERSION_UNSUPPORTED`, `BACKUP_FORMAT_INVALID`, `BACKUP_TOO_LARGE`,
`BACKUP_ATTACHMENT_MISSING`, `BACKUP_ATTACHMENT_INVALID`, `RESTORE_CONFLICT`,
`RESTORE_FAILED`, `LEGACY_IMPORT_INVALID`, and `LEGACY_IMPORT_CONFLICT`, plus the
existing authentication, CSRF, Company-role, and Company-not-found codes.

## 22. Audit events

Successful operations record `BACKUP_CREATED`, `COMPANY_RESTORED`, and
`LEGACY_IMPORT_COMMITTED` with safe counts and relevant Company/User IDs.
Passphrases, keys, file contents, session tokens, and physical paths are excluded.
Preview remains genuinely mutation-free and therefore does not write an audit row.
The JSON backup request has a redacted `toString`, and multipart passphrases avoid
message-converter body logging.

## 23. Tests added

Six M6 integration tests cover full logical round trip; exact Company, Settings,
Region, Party, Transaction, amount/date/note, balance, dashboard, report, metadata,
and attachment-byte preservation; random encryption; password redaction; wrong
passphrase; header/ciphertext tampering; future versions; path attacks; entry and
expansion limits; OWNER/ADMIN/ACCOUNTANT/VIEWER and cross-Company enforcement;
conflict handling; rollback/file compensation; representative frontend legacy
preview/commit; date-time reduction; decimal rejection; owner creation; appearance
import; and the legacy attachment warning/no-placeholder rule.

## 24. Total test result

`mvn test` and the package lifecycle completed with **50 tests, 0 failures,
0 errors, and 0 skipped**. This is the 44-test M1-M5 suite plus 6 M6 integration
tests.

## 25. Package result

`mvn package` succeeded and produced the executable
`backend/target/ledgerflow-backend-0.0.1-SNAPSHOT.jar` using Flyway V1-V3.

## 26. HTTP smoke result

The packaged JAR ran against a fresh isolated SQLite database and data directory.
The script registered, logged in, created the complete ledger chain, uploaded a
PDF, created an encrypted backup, deleted the original Transaction, confirmed the
original Dashboard changed, previewed and restored as new, downloaded and compared
the PDF bytes, verified Dashboard and Party Statement totals, and logged out.
Result: `BACKUP_RESTORE_SMOKE_OK`.

## 27. Deferred to M7

M7 will connect the existing React UI to authentication, bootstrap/company entry,
server CRUD, reports, real attachments, `.lfbak` preview/restore, and the legacy
LocalStorage migration flow. It must retain local data until server commit and
verification succeed. Frontend integration, automatic LocalStorage deletion,
browser E2E, and desktop packaging were not started. Destructive
`REPLACE_EXISTING` remains a later recovery feature rather than part of M7's
required integration.

If a user forgets an `.lfbak` passphrase, LedgerFlow cannot recover that backup.
There is no master password, hard-coded key, or decryption backdoor.
