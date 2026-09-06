import { StrictMode } from "react";

import {
  createRoot,
} from "react-dom/client";

import {
  BrowserRouter,
} from "react-router-dom";

import App from "./App";

import SettingsAwareToaster from "./components/settings/SettingsAwareToaster";

import {
  LedgerProvider,
} from "./context/LedgerContext";

import {
  SettingsProvider,
} from "./context/SettingsProvider";

import "./index.css";

createRoot(
  document.getElementById(
    "root",
  )!,
).render(
  <StrictMode>
    <LedgerProvider>
      <SettingsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>

        <SettingsAwareToaster />
      </SettingsProvider>
    </LedgerProvider>
  </StrictMode>,
);
