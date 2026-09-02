import {
  ArrowLeftRight,
  DatabaseBackup,
  FileText,
  LayoutDashboard,
  MapPin,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const menuItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Parties",
    path: "/parties",
    icon: Users,
  },
  {
    name: "Transactions",
    path: "/transactions",
    icon: ArrowLeftRight,
  },
  {
    name: "Regions",
    path: "/regions",
    icon: MapPin,
  },
  {
    name: "Reports",
    path: "/reports",
    icon: FileText,
  },
];

export default function Sidebar() {
  const navStyle = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
      isActive
        ? "bg-white text-slate-950 shadow-sm"
        : "text-slate-400 hover:bg-slate-900 hover:text-white"
    }`;

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-slate-950 text-white lg:flex">

      {/* Logo */}
      <div className="flex h-20 shrink-0 items-center border-b border-slate-800 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-950">
            <WalletCards size={21} />
          </div>

          <div>
            <h1 className="font-semibold">
              LedgerFlow
            </h1>

            <p className="text-xs text-slate-400">
              Business Ledger
            </p>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {menuItems.map(({ name, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={navStyle}
            >
              <Icon size={19} />

              {name}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom navigation */}
      <div className="shrink-0 border-t border-slate-800 p-4">
        <div className="space-y-1">

          <NavLink
            to="/backup"
            className={navStyle}
          >
            <DatabaseBackup size={19} />
            Backup & Restore
          </NavLink>

          <NavLink
            to="/settings"
            className={navStyle}
          >
            <Settings size={19} />
            Settings
          </NavLink>

        </div>

        {/* Local storage status */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4">

          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />

            <p className="text-xs font-medium text-slate-300">
              Local storage
            </p>
          </div>

          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            Your data stays on this device
          </p>

        </div>
      </div>

    </aside>
  );
}