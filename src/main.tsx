import { StrictMode } from "react";

import {
  createRoot,
} from "react-dom/client";

import {
  BrowserRouter,
} from "react-router-dom";

import {
  Toaster,
} from "sonner";

import App from "./App";

import {
  LedgerProvider,
} from "./context/LedgerContext";

import "./index.css";

createRoot(
  document.getElementById(
    "root",
  )!,
).render(
  <StrictMode>
    <BrowserRouter>
      <LedgerProvider>
        <App />

        <Toaster
          position="top-right"
          richColors
          closeButton
        />
      </LedgerProvider>
    </BrowserRouter>
  </StrictMode>,
);