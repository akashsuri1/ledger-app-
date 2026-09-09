import assert from "node:assert/strict";

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { TransactionModalProvider } from "../src/context/TransactionModalContext";
import AddTransactionModal from "../src/components/dashboard/AddTransactionModal";
import EditTransactionModal from "../src/components/transactions/EditTransactionModal";
import ManageCompaniesModal from "../src/components/companies/ManageCompaniesModal";
import CompanySelection from "../src/pages/CompanySelection/CompanySelection";
import { LedgerProvider } from "../src/context/LedgerContext";
import { SettingsProvider } from "../src/context/SettingsProvider";
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
import { DEFAULT_PRINT_SETTINGS } from "../src/utils/settingsStorage";
import {
  loadWorkspace,
  WORKSPACE_STORAGE_KEY,
} from "../src/utils/workspaceStorage";

function renderPage(
  element: React.ReactNode,
  path: string,
  routePath = path,
) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <LedgerProvider>
        <SettingsProvider>
          <TransactionModalProvider>
            <Routes>
              <Route path={routePath} element={element} />
            </Routes>
          </TransactionModalProvider>
        </SettingsProvider>
      </LedgerProvider>
    </MemoryRouter>,
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

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const freshStorage = new Map<string, string>();
let firstCompanyMarkup: string;
try {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => freshStorage.get(key) ?? null,
        setItem: (key: string, value: string) => freshStorage.set(key, value),
      },
    },
  });
  firstCompanyMarkup = renderPage(<Reports />, "/reports");
} finally {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
}

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

const multiCompanyWorkspace = loadWorkspace(null).workspace;
multiCompanyWorkspace.companies.push({
  ...multiCompanyWorkspace.companies[0],
  id: 2,
  name: "Suri Trading",
  gstin: "03XYZAB1234C1Z5",
});
const multiCompanyStorage = new Map<string, string>([
  [
    WORKSPACE_STORAGE_KEY,
    JSON.stringify({
      format: "ledgerflow-workspace",
      version: 1,
      savedAt: "2026-09-09T10:00:00.000Z",
      data: multiCompanyWorkspace,
    }),
  ],
]);
let companySelectionMarkup: string;
try {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => multiCompanyStorage.get(key) ?? null,
        setItem: (key: string, value: string) =>
          multiCompanyStorage.set(key, value),
      },
    },
  });
  companySelectionMarkup = renderPage(
    <CompanySelection />,
    "/select-company",
  );
} finally {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
}

for (const expected of [
  "Welcome back",
  "Choose a company to continue",
  multiCompanyWorkspace.companies[0].name,
  "Suri Trading",
  "Open company",
  "Create company",
  "Last used",
]) {
  assert.ok(
    companySelectionMarkup.includes(expected),
    `Company selection did not render expected text: ${expected}`,
  );
}

const companyForDeletion = {
  id: 1,
  name: "Empty Company",
  address: "",
  phone: "",
  gstin: "",
  email: "",
  createdAt: "2026-09-01T10:00:00.000Z",
  settings: {
    statementHeader: "Statement of Account",
    statementFooter: "",
    print: { ...DEFAULT_PRINT_SETTINGS },
  },
};
const companyManagerProps = {
  open: true,
  companies: [companyForDeletion],
  activeCompanyId: 1,
  onClose: () => undefined,
  onCreate: () => undefined,
  onEdit: () => undefined,
  onSwitch: () => undefined,
  onDelete: () => undefined,
};
const deletableCompanyMarkup = renderToStaticMarkup(
  <ManageCompaniesModal
    {...companyManagerProps}
    deletableCompanyIds={new Set([1])}
  />,
);
const protectedCompanyMarkup = renderToStaticMarkup(
  <ManageCompaniesModal
    {...companyManagerProps}
    deletableCompanyIds={new Set()}
  />,
);
assert.ok(deletableCompanyMarkup.includes("Delete company"));
assert.ok(!protectedCompanyMarkup.includes(">Delete company<"));

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

for (const [name, markup] of [
  [
    "Add transaction",
    renderPage(
      <AddTransactionModal open onClose={() => undefined} />,
      "/transactions",
    ),
  ],
  [
    "Edit transaction",
    renderPage(
      <EditTransactionModal
        open
        transactionId={101}
        onClose={() => undefined}
      />,
      "/transactions",
    ),
  ],
] as const) {
  assert.ok(markup.includes('type="date"'), `${name} must render a date picker.`);
  assert.ok(!markup.includes('type="datetime-local"'), `${name} must not render a time picker.`);
  assert.ok(!markup.includes("Date &amp; Time"), `${name} must not request a time.`);
}

for (const limit of ["1", "25", "100", "1000", "10000"]) {
  const markup = renderPage(<Reports />, `/reports?party=1&limit=${limit}&limitMode=custom`, "/reports");
  assert.ok(markup.includes('<option value="CUSTOM" selected="">'),
    `Custom mode must remain selected when the count is ${limit}.`);
  const customInputMarkup = markup.match(/<input[^>]*placeholder="Enter 1 to 10,000"[^>]*>/)?.[0];
  assert.ok(customInputMarkup?.includes(`value="${limit}"`),
    `Custom input must display the URL count ${limit}.`);
  assert.ok(!markup.includes("Invalid transaction limit"));
}

for (const limit of ["0", "10001", "1.5", "invalid"]) {
  const markup = renderPage(<Reports />, `/reports?party=1&limit=${limit}`, "/reports");
  assert.ok(markup.includes("Invalid transaction limit"));
  assert.ok(/<button[^>]*disabled=""[^>]*>[\s\S]*?Print report/.test(markup),
    `Printing must be disabled for the invalid URL count ${limit}.`);
}

console.log("LedgerFlow page component smoke checks passed.");
