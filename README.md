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

## Desktop application

Add the desktop project under `desktop/` after the HTTP API and frontend API
integration are stable. The package can then build `frontend/dist`, bundle the
backend runtime and database migrations, and store the live database in the
operating system's application-data directory.
