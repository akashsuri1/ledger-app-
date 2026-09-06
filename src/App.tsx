import {
  lazy,
  Suspense,
} from "react";

import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";

const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const Parties = lazy(() => import("./pages/Parties/Parties"));
const PartyDetails = lazy(
  () => import("./pages/PartyDetails/PartyDetails"),
);
const Transactions = lazy(
  () => import("./pages/Transactions/Transactions"),
);
const Regions = lazy(() => import("./pages/Regions/Regions"));
const Reports = lazy(() => import("./pages/Reports/Reports"));
const Backup = lazy(() => import("./pages/Backup/Backup"));
const Settings = lazy(() => import("./pages/Settings/Settings"));
const NotFound = lazy(() => import("./pages/NotFound/NotFound"));

function RouteFallback() {
  return (
    <div
      role="status"
      className="flex min-h-[50vh] items-center justify-center text-sm font-medium text-slate-500"
    >
      Loading LedgerFlow…
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppLayout />}>
        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/parties"
          element={<Parties />}
        />

        <Route
          path="/parties/:partyId"
          element={<PartyDetails />}
        />

        <Route
          path="/transactions"
          element={<Transactions />}
        />

        <Route
          path="/regions"
          element={<Regions />}
        />

        <Route
          path="/reports"
          element={<Reports />}
        />

        <Route
          path="/backup"
          element={<Backup />}
        />

        <Route
          path="/settings"
          element={<Settings />}
        />
          <Route
            path="*"
            element={<NotFound />}
          />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
