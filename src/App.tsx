import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";

import Dashboard from "./pages/Dashboard/Dashboard";
import Parties from "./pages/Parties/Parties";
import PartyDetails from "./pages/PartyDetails/PartyDetails";
import Transactions from "./pages/Transactions/Transactions";
import Regions from "./pages/Regions/Regions";
import Reports from "./pages/Reports/Reports";
import Backup from "./pages/Backup/Backup";
import Settings from "./pages/Settings/Settings";

function App() {
  return (
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
      </Route>
    </Routes>
  );
}

export default App;