# LedgerFlow desktop shell

The desktop package uses Tauri 2 as a trusted process supervisor and native Windows shell. Business logic remains in the bundled Spring Boot JAR, and the existing React application is served by Spring Boot over a dynamically selected loopback port. The app owns that backend process and requests a graceful shutdown when the desktop window closes.

Run `..\scripts\build-desktop.ps1` from the repository root to create the NSIS installer. The generated Java runtime and backend resources under `src-tauri/resources/` are staging output and are not committed. Desktop data is stored in `%LOCALAPPDATA%\com.ledgerflow.desktop`, separate from the installation directory.
