import assert from "node:assert/strict";

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { TransactionModalProvider } from "../src/context/TransactionModalContext";
import { LedgerProvider } from "../src/context/LedgerContext";
import { SettingsProvider } from "../src/context/SettingsProvider";
import FirstCompanySetup from "../src/components/companies/FirstCompanySetup";
import { PartyReportFilters } from "../src/components/reports/ReportFilters";
import type { StatementPrintPreferences } from "../src/types/reports";
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
    expected: [
      "Transactions",
      "Goods supplied",
      "10 per page",
      "View transaction",
      "Edit transaction",
      "Delete transaction",
    ],
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

const partyFilterPreferences: StatementPrintPreferences = {
  transactionLimit: 20,
  showRunningBalance: true,
  showNotes: true,
  showAttachment: true,
  showTransactionTime: true,
  showBusinessAddress: true,
  showBusinessPhone: true,
  showBusinessGstin: true,
  showGeneratedDate: true,
  orientation: "portrait",
  customFooter: "",
};

const partyFilterMarkup = renderToStaticMarkup(
  <PartyReportFilters
    parties={[]}
    regions={[]}
    selectedPartyId=""
    preferences={partyFilterPreferences}
    customTransactionLimit="20"
    usesCustomTransactionLimit
    onTransactionLimitChange={() => undefined}
    onPartyChange={() => undefined}
    onCustomTransactionLimitChange={() => undefined}
    onPreferencesChange={() => undefined}
  />,
);

const firstCompanyMarkup = renderToStaticMarkup(
  <MemoryRouter>
    <FirstCompanySetup
      onCreate={() => {
        throw new Error("The static setup check must not submit the form.");
      }}
    />
  </MemoryRouter>,
);

for (const expected of [
  "Welcome to LedgerFlow",
  "Create your company",
  "Company Name *",
  "GSTIN",
  "Phone",
  "Email",
  "Address",
  "Create Company",
]) {
  assert.ok(
    firstCompanyMarkup.includes(expected),
    `First-company setup did not render expected text: ${expected}`,
  );
}

assert.ok(
  partyFilterMarkup.includes("Custom number"),
  "Party statement filters did not render the custom transaction option.",
);
assert.ok(
  partyFilterMarkup.includes('type="number"'),
  "Party statement filters did not render the custom transaction input.",
);
assert.ok(
  !partyFilterMarkup.includes('type="date"'),
  "Party statement filters unexpectedly rendered a date input.",
);

console.log("LedgerFlow page component smoke checks passed.");
