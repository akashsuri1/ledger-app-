import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Header from "./Header";

import { TransactionModalProvider } from "../../context/TransactionModalContext";

export default function AppLayout() {
  return (
    <TransactionModalProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Header />

          <main className="min-h-[calc(100vh-5rem)] p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </TransactionModalProvider>
  );
}
