# LedgerFlow desktop shell

This directory is reserved for the desktop packaging layer. Add Tauri or Electron
after the backend HTTP contract and frontend API integration are stable.

The desktop package will:

- build and embed `../frontend/dist`;
- start or connect to the packaged `../backend` service;
- place SQLite data in the operating system's application-data directory;
- manage application startup, shutdown, updates, and local API configuration.

No desktop runtime is selected or installed during backend milestone 1.
