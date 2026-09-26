# Milestone 9 — Desktop Packaging Report

## Summary

LedgerFlow M9 wraps the tested React + Spring Boot + SQLite application into a standalone Windows desktop installer using Tauri 2. The end user does not need Java, Node.js, Maven, or any development tooling installed to run LedgerFlow.

## Architecture

```text
LedgerFlow_0.1.0_x64-setup.exe   (NSIS installer)
       │
       └─ LedgerFlow.exe          (Tauri native shell)
              │
              ├─ Bundled Java runtime (jlink, OpenJDK 23)
              │
              ├─ ledgerflow-backend.jar (Spring Boot executable JAR)
              │
              └─ React production UI (served by Spring Boot)
```

### Runtime Flow

```text
Launch LedgerFlow.exe
    ↓
Show "Starting LedgerFlow" splash (ui/index.html)
    ↓
Prepare %LOCALAPPDATA%\com.ledgerflow.desktop\data
    ↓
Select free loopback port
    ↓
Generate 48-character shutdown token
    ↓
Launch bundled javaw.exe -jar ledgerflow-backend.jar
    with -Dspring.profiles.active=desktop
         -Dserver.port=<dynamic>
         -Dserver.address=127.0.0.1
         -Dledgerflow.data-dir=<app-data>
         -Dledgerflow.desktop.shutdown-token=<token>
    ↓
Poll GET /api/health (up to 45 seconds, 3 attempts)
    ↓
Navigate WebView2 to http://127.0.0.1:<port>/
    ↓
Monitor backend process for unexpected exit
    ↓
On window close:
    POST /api/desktop/shutdown with token header
    Wait up to 6 seconds for graceful exit
    Force terminate if necessary
```

## Windows Target

- Architecture: x64
- Installer: NSIS `.exe` (`LedgerFlow_0.1.0_x64-setup.exe`)
- Install mode: `currentUser` (no admin required)
- WebView2: auto-downloaded via silent bootstrapper if missing

## Bundled Java Runtime

- Source JDK: OpenJDK 23
- Created with: `jlink`
- Modules included:
  - `java.base`, `java.compiler`, `java.desktop`, `java.instrument`
  - `java.logging`, `java.management`, `java.naming`, `java.net.http`
  - `java.security.jgss`, `java.sql`, `java.xml`
  - `jdk.crypto.ec`, `jdk.unsupported`, `jdk.zipfs`
- Optimizations: `--strip-debug --no-header-files --no-man-pages --compress=zip-6`

## Backend Startup

- Spring profile: `desktop`
- Dynamic port: selected by binding to `127.0.0.1:0` and reading the assigned port
- Backend process: launched as a hidden child process (`CREATE_NO_WINDOW` on Windows)
- Stdout/stderr: redirected to `logs/backend-process.log`
- Spring logging: directed to `logs/backend.log` with 5 MB rolling policy

## Dynamic Port

The backend never assumes port 8080. On each launch, Tauri selects an available loopback port. The backend binds exclusively to `127.0.0.1`, never exposing the service to the local network.

## Health Check

```
GET /api/health
```

Response:
```json
{"status": "UP"}
```

The health endpoint executes `SELECT 1` against SQLite to verify database connectivity. Tauri polls every 150 ms for up to 45 seconds per attempt, with 3 attempts total.

## Application Data Directory

```text
%LOCALAPPDATA%\com.ledgerflow.desktop\
├── data\
│   └── ledgerflow.db          (SQLite database)
├── logs\
│   ├── backend.log            (Spring Boot application log)
│   ├── backend-process.log    (Java process stdout/stderr)
│   └── desktop-supervisor.log (Tauri supervisor events)
└── (attachments and backups are stored under data/)
```

Data is stored in the Windows application-data directory, completely separate from the installation directory. Uninstallation removes the application but preserves user data.

## SQLite Location

- Desktop: `%LOCALAPPDATA%\com.ledgerflow.desktop\data\ledgerflow.db`
- Development: `~/.ledgerflow/data/ledgerflow.db`
- Configurable via `LEDGERFLOW_DATA_DIR` environment variable or `-Dledgerflow.data-dir`

## Attachment Location

Attachments are stored under the `data-dir` directory in the `attachments/` subdirectory, using UUID-based filenames. The same storage abstraction is used for both development and desktop modes.

## Logs

| Log | Location | Purpose |
|-----|----------|---------|
| `backend.log` | `logs/` | Spring Boot application log (5 MB rolling, 5 files, 25 MB cap) |
| `backend-process.log` | `logs/` | Raw Java process stdout/stderr |
| `desktop-supervisor.log` | `logs/` | Tauri supervisor events (startup, shutdown, crashes) |

## Single Instance

Tauri's `single-instance` plugin ensures only one LedgerFlow instance runs at a time. If a second instance is launched, the existing window is focused (shown, unminimized, brought to front).

## Shutdown Behavior

1. User closes LedgerFlow window
2. Tauri sends `POST /api/desktop/shutdown` with the private token in `X-LedgerFlow-Shutdown` header
3. Backend verifies the token (constant-time comparison, minimum 32 bytes) and the request originates from localhost
4. Backend initiates a 150 ms delayed `context.close()` (allows the HTTP response to complete)
5. Tauri waits up to 6 seconds for the Java process to exit
6. If the process has not exited, Tauri forcefully terminates it

The shutdown endpoint is only available when the `desktop` Spring profile is active. It is not exposed in development mode.

## Crash Behavior

A background monitor thread checks the backend process every second. If the process exits unexpectedly (and Tauri did not initiate shutdown), the WebView displays a user-friendly message:

> **LedgerFlow service stopped**
> Your data remains on this computer. Close LedgerFlow and open it again. Details were written to the application log.

## Installer

- Type: NSIS `.exe`
- File: `LedgerFlow_0.1.0_x64-setup.exe`
- Size: ~68 MB
- Install mode: per-user (`currentUser`), no administrator required
- Start Menu entry: created
- Installer icon: LedgerFlow branded icon
- Uninstall: removes application binaries; **preserves user data** in `%LOCALAPPDATA%`

## WebView2 Strategy

```json
"webviewInstallMode": {
  "type": "downloadBootstrapper",
  "silent": true
}
```

If WebView2 is not already installed (it ships with Windows 10 21H2+ and Windows 11), the installer silently downloads and installs the bootstrapper.

## Code Signing Status

No code-signing certificate is configured. The installer is unsigned. Windows SmartScreen may show warnings on first run. Code signing is documented as future release infrastructure work.

## Updater Status

No automatic updater is configured. Updates require downloading and running a new installer. Auto-update infrastructure is documented as future work.

## Build Commands

### Full Build (from repository root)

```powershell
$env:JAVA_HOME = "C:\Users\HP\.jdks\openjdk-23"
.\scripts\build-desktop.ps1
```

This runs the complete pipeline:
1. Frontend: `npm ci` → lint → test → `npm run build`
2. Backend: `mvn clean package`
3. jlink: creates bundled Java runtime
4. Stages: JAR + runtime into `desktop/src-tauri/resources/`
5. Rust: `cargo check` → `tauri build` → NSIS installer

### Prepare Resources Only

```powershell
.\scripts\prepare-desktop.ps1 -JdkHome "C:\Users\HP\.jdks\openjdk-23"
```

### Skip Quality Checks

```powershell
.\scripts\build-desktop.ps1 -SkipQualityChecks
```

## Test Results

### Backend Tests

```
Tests run: 68, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Including:
- `DesktopHostingIntegrationTest`: SPA fallback routing, API path exclusion, shutdown token security

### Frontend

```
npm run build: ✅ passed
npm run lint: ✅ passed
```

### Bundled Runtime Test (`test-bundled-runtime.ps1`)

```
M9_BUNDLED_RUNTIME_OK
M9_CLEAN_SHUTDOWN_OK
```

Verified:
- Bundled `javaw.exe` starts the backend without system Java
- Health check returns `{"status":"UP"}`
- Backend binds exclusively to IPv4 loopback (`127.0.0.1`)
- Desktop SPA route (`/dashboard`) returns the production UI containing "LedgerFlow"
- Shutdown via token-authenticated POST stops the backend gracefully
- SQLite database is created in the test application-data directory

### Fresh Install

```
M9_FRESH_INSTALL_OK: pending manual verification
```

The NSIS installer has been generated. Full install-launch-register-use-restart cycle should be verified manually.

### Desktop E2E

```
M9_DESKTOP_E2E_OK: pending manual verification
```

Requires manual walkthrough:
1. Install LedgerFlow via NSIS installer
2. Launch — no Java on PATH required
3. Register → Login → Create Company → Add Region → Add Party
4. Credit ₹25,000 → Debit ₹10,000 → Verify ₹15,000 balance
5. Add attachment → View Dashboard → Generate Report
6. Create encrypted backup → Close → Reopen → Verify data persists
7. Restore backup as new Company → Verify data integrity

## Security

Desktop mode preserves all security from M1–M8:
- Authentication: bcrypt, HttpOnly cookies, session rotation
- CSRF: enabled (SameSite=Lax, same-origin loopback)
- Authorization: backend role enforcement (OWNER/ADMIN/ACCOUNTANT/VIEWER)
- Company isolation: backend-enforced
- Attachments: MIME/signature validation, UUID storage
- Backup encryption: AES-256-GCM + PBKDF2-HMAC-SHA256

Desktop-specific security:
- Backend bound to `127.0.0.1` only (never LAN-exposed)
- Shutdown endpoint requires private 48-character token + localhost origin
- `secure-cookies: false` (loopback HTTP, not HTTPS — intentional for desktop)
- Tauri capabilities: `core:default` only — no shell, no filesystem, no process access for the web UI

## Known Limitations

1. **Unsigned installer**: Windows SmartScreen warning on first run
2. **No auto-updater**: manual update via new installer
3. **No crash recovery prompt**: crash shows static HTML message; user must manually restart
4. **Single platform**: Windows x64 only (macOS/Linux not targeted)
5. **Startup time**: ~10–15 seconds for JVM + Spring Boot initialization
6. **Installer size**: ~68 MB due to bundled JVM runtime

## Files Added/Modified in M9

### New Files
- `desktop/` — Tauri 2 project (package.json, src-tauri/, ui/)
- `backend/src/main/java/com/ledgerflow/desktop/DesktopShutdownController.java`
- `backend/src/main/java/com/ledgerflow/desktop/DesktopSpaConfiguration.java`
- `backend/src/main/resources/application-desktop.yml`
- `backend/src/test/java/com/ledgerflow/DesktopHostingIntegrationTest.java`
- `backend/src/test/resources/static/index.html`
- `scripts/prepare-desktop.ps1`
- `scripts/build-desktop.ps1`
- `scripts/test-bundled-runtime.ps1`

### Modified Files
- `.gitignore` — desktop build artifacts
- `README.md` — project overview
- `backend/pom.xml` — version/dependencies
- `backend/src/main/java/com/ledgerflow/security/SecurityConfiguration.java` — desktop shutdown endpoint permit
- `frontend/src/api/apiClient.ts` — desktop base URL detection
- `frontend/package.json` — version alignment

## Conclusion

M9 desktop packaging is code-complete. The NSIS installer packages the React UI, Spring Boot backend, SQLite database engine, and a minimal Java runtime into a single self-contained Windows application. All automated tests pass. Manual install-and-use verification is the remaining validation step before closing M9.
