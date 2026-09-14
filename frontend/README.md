# LedgerFlow frontend

This React, TypeScript, Vite, and Tailwind application uses the Spring Boot API
as the source of truth for authentication, companies, ledger records, dashboard
totals, reports, settings, attachments, and encrypted backups.

## Development

Requirements: Node.js 20+ and a running LedgerFlow backend.

Terminal 1:

```powershell
cd backend
$env:JAVA_HOME = "C:\Users\HP\.jdks\openjdk-23"
.\mvnw.cmd spring-boot:run
```

Terminal 2:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

The default API URL is `http://localhost:8080`. Set `VITE_API_BASE_URL` in
`.env.local` to use another backend. All API requests use cookie credentials;
mutations automatically obtain the `XSRF-TOKEN` cookie and send it through the
`X-XSRF-TOKEN` header. The backend allows `http://localhost:5173` by default.

## Integrated behavior

- Login, registration, password reset, protected routes, logout, and session-expiry handling.
- Zero companies open setup, one opens the dashboard, and multiple open company selection unless a valid remembered company is enabled.
- Server-side Party and Transaction search, filters, and pagination.
- Async Company, Region, Party, and Transaction mutations with backend errors.
- Backend-derived Dashboard and report accounting.
- Whole-rupee values and date-only `YYYY-MM-DD` Transaction fields.
- PDF/JPG/PNG upload, replacement, download, and removal through authorized endpoints.
- Owner-only encrypted `.lfbak` creation, preview, and restore as a new company.
- Explicit legacy browser-workspace preview/import while retaining the original LocalStorage value.

The legacy workspace and backup utilities remain in the source tree so existing
browser data can be detected and migrated safely. Normal live ledger changes are
not written to LocalStorage.

## Checks

```powershell
npm test
npm run lint
npm run build
```

`npm test` covers legacy workspace compatibility, routing decisions, API error
normalization, credential and CSRF behavior, whole-rupee/date-only controls, and
component rendering. The repository smoke script runs the packaged backend and
Vite frontend together:

```powershell
$env:JAVA_HOME = "C:\Users\HP\.jdks\openjdk-23"
powershell -ExecutionPolicy Bypass -File ..\scripts\frontend-backend-smoke.ps1
```
