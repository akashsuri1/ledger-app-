# LedgerFlow

LedgerFlow is organized as a single repository for the web frontend, Spring Boot
backend, shared documentation, and a future desktop shell.

```text
ledger-app/
├── frontend/   React, TypeScript, Vite, and Tailwind CSS
├── backend/    Spring Boot, JDBC, SQLite, and Flyway
├── docs/       Backend contract and implementation handoff
└── desktop/    Reserved for a future Tauri or Electron wrapper
```

The desktop wrapper should treat the frontend as its UI and start or connect to
the backend through a configured local API. Keeping the three applications at the
repository root avoids moving build paths again when desktop packaging begins.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

See [frontend/README.md](frontend/README.md) for features, LocalStorage migration,
backup behavior, and frontend checks.

Run the backend first on port 8080. Copy `frontend/.env.example` to
`frontend/.env.local` when a different API URL is needed. The frontend sends
credentialed cookie requests and the backend allows `http://localhost:5173` by
default.

## Backend

```powershell
cd backend
$env:JAVA_HOME = "C:\Users\HP\.jdks\openjdk-23"
./mvnw.cmd test
./mvnw.cmd package
```

See [backend/README.md](backend/README.md) for the database location and backend
commands. The full contract is in [docs/BACKEND_HANDOFF.md](docs/BACKEND_HANDOFF.md).

## Windows desktop application

LedgerFlow has a Tauri 2 Windows x64 desktop package. It bundles Java, the Spring
Boot backend, the React production build, and the SQLite migrations. No separate
Java installation or backend command is needed to run the installed app.

Build the installer from the repository root:

```powershell
$env:JAVA_HOME = "C:\Users\HP\.jdks\openjdk-23"
.\scripts\build-desktop.ps1 -JdkHome $env:JAVA_HOME
```

The installer is written to:

```text
desktop\src-tauri\target\release\bundle\nsis\LedgerFlow_0.1.0_x64-setup.exe
```

The installed application starts its own backend on a randomly selected
`127.0.0.1` port and serves the UI from that same origin. Its live desktop data is
kept under `%LOCALAPPDATA%\com.ledgerflow.desktop\data`; logs are in the sibling
`logs` directory.

### Inspecting the desktop database

LedgerFlow uses SQLite. Close LedgerFlow first, then open
`%LOCALAPPDATA%\com.ledgerflow.desktop\data\ledgerflow.db` with DB Browser for
SQLite or SQLiteStudio. Use the Browse Data and Execute SQL views to inspect it;
do not edit the live database directly. For a command-line check, run:

```powershell
sqlite3 "$env:LOCALAPPDATA\com.ledgerflow.desktop\data\ledgerflow.db" ".tables"
sqlite3 "$env:LOCALAPPDATA\com.ledgerflow.desktop\data\ledgerflow.db" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

While the app is open, use its encrypted backup feature for a consistent copy, or
stop the app before copying the database. The logs at
`%LOCALAPPDATA%\com.ledgerflow.desktop\logs\backend.log` and
`desktop-supervisor.log` show startup and backend activity without exposing
passwords or backup passphrases.
