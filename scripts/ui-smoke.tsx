import assert from "node:assert/strict";

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { TransactionModalProvider } from "../src/context/TransactionModalContext";
import { LedgerProvider } from "../src/context/LedgerContext";
import { SettingsProvider } from "../src/context/SettingsProvider";
import Backup from "../src/pages/Backup/Backup";
import Dashboard from "../src/pages/Dashboard/Dashboard";
import NotFound from "../src/pages/NotFound/NotFound";
import Parties from "../src/pages/Parties/Parties";
import PartyDetails from "../src/pages/PartyDetails/PartyDetails";
import Regions from "../src/pages/Regions/Regions";
import Reports from "../src/pages/Reports/Reports";
import Settings from "../src/pages/Settings/Settings";
import Transactions from "../src/pages/Transactions/Transactions";

function renderPage(
  element: React.ReactNode,
  path: string,
  routePath = path,
) {
  return renderToStaticMarkup(
    <LedgerProvider>
      <SettingsProvider>
        <MemoryRouter initialEntries={[path]}>
          <TransactionModalProvider>
            <Routes>
              <Route path={routePath} element={element} />
            </Routes>
          </TransactionModalProvider>
        </MemoryRouter>
      </SettingsProvider>
    </LedgerProvider>,
  );
}

const checks: Array<{
  name: string;
  path: string;
  expected: string[];
  element: React.ReactNode;
  routePath?: string;
}> = [
  {
    name: "Dashboard",
    path: "/dashboard",
    expected: ["Dashboard", "Total Receivable", "Recent Transactions"],
    element: <Dashboard />,
  },
  {
    name: "Parties",
    path: "/parties",
    expected: ["Parties", "ABC Traders", "Page", "10 per page"],
    element: <Parties />,
  },
  {
    name: "Transactions",
    path: "/transactions",
    expected: ["Transactions", "Goods supplied", "10 per page"],
    element: <Transactions />,
  },
  {
    name: "Regions",
    path: "/regions",
    expected: ["Regions", "Punjab"],
    element: <Regions />,
  },
  {
    name: "Reports",
    path: "/reports",
    expected: ["Reports", "Party Statement"],
    element: <Reports />,
  },
  {
    name: "Backup",
    path: "/backup",
    expected: ["Backup &amp; Restore", "Download full backup"],
    element: <Backup />,
  },
  {
    name: "Settings",
    path: "/settings",
    expected: ["Settings", "Business", "Appearance"],
    element: <Settings />,
  },
  {
    name: "Party details",
    path: "/parties/1",
    routePath: "/parties/:partyId",
    expected: ["ABC Traders", "Goods supplied"],
    element: <PartyDetails />,
  },
  {
    name: "Invalid party",
    path: "/parties/999999",
    routePath: "/parties/:partyId",
    expected: ["Party not found"],
    element: <PartyDetails />,
  },
  {
    name: "Not found",
    path: "/missing-route",
    routePath: "*",
    expected: ["Error 404", "Page not found"],
    element: <NotFound />,
  },
];

for (const check of checks) {
  const markup = renderPage(
    check.element,
    check.path,
    check.routePath,
  );

  for (const expected of check.expected) {
    assert.ok(
      markup.includes(expected),
      `${check.name} did not render expected text: ${expected}`,
    );
  }
}

console.log("LedgerFlow page component smoke checks passed.");
