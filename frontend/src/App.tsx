import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { companyApi } from "./api/companyApi";
import AppLayout from "./components/layout/AppLayout";
import FirstCompanySetup from "./components/companies/FirstCompanySetup";
import SettingsAwareToaster from "./components/settings/SettingsAwareToaster";
import { LedgerProvider } from "./context/LedgerContext";
import { SettingsProvider } from "./context/SettingsProvider";
import { useAuth } from "./hooks/useAuth";
import { useLedger } from "./hooks/useLedger";
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from "./pages/Auth/AuthPages";
import type { Company, NewCompany } from "./types";

const Dashboard=lazy(()=>import("./pages/Dashboard/Dashboard")); const Parties=lazy(()=>import("./pages/Parties/Parties"));
const PartyDetails=lazy(()=>import("./pages/PartyDetails/PartyDetails")); const Transactions=lazy(()=>import("./pages/Transactions/Transactions"));
const Regions=lazy(()=>import("./pages/Regions/Regions")); const Reports=lazy(()=>import("./pages/Reports/Reports"));
const Backup=lazy(()=>import("./pages/Backup/Backup")); const Settings=lazy(()=>import("./pages/Settings/Settings"));
const NotFound=lazy(()=>import("./pages/NotFound/NotFound")); const CompanySelection=lazy(()=>import("./pages/CompanySelection/CompanySelection"));

function RouteFallback(){return <div role="status" className="flex min-h-[50vh] items-center justify-center text-sm font-medium text-slate-500">Loading LedgerFlow...</div>}

function BusinessRoutes(){
  const { companySelectionRequired, isLoading, error }=useLedger();
  if(companySelectionRequired)return <Routes><Route path="/select-company" element={<CompanySelection/>}/><Route path="*" element={<Navigate to="/select-company" replace/>}/></Routes>;
  return <>{error&&<div role="alert" className="fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-xl bg-rose-700 px-4 py-3 text-sm text-white shadow-lg">{error}</div>}{isLoading&&<div className="fixed right-4 top-4 z-[100] rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white shadow">Refreshing company...</div>}<Routes>
    <Route path="/select-company" element={<CompanySelection/>}/><Route path="/login" element={<Navigate to="/dashboard" replace/>}/><Route path="/register" element={<Navigate to="/dashboard" replace/>}/>
    <Route element={<AppLayout/>}><Route path="/" element={<Navigate to="/dashboard" replace/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/parties" element={<Parties/>}/><Route path="/parties/:partyId" element={<PartyDetails/>}/><Route path="/transactions" element={<Transactions/>}/><Route path="/regions" element={<Regions/>}/><Route path="/reports" element={<Reports/>}/><Route path="/backup" element={<Backup/>}/><Route path="/settings" element={<Settings/>}/><Route path="*" element={<NotFound/>}/></Route>
  </Routes></>;
}

function AuthenticatedApp(){
  const auth=useAuth();
  if(auth.companies.length===0){
    const create=async(input:NewCompany):Promise<Company>=>{const value=await companyApi.create(input);await auth.refreshBootstrap();return {...value,settings:{statementHeader:"Statement of Account",statementFooter:"",print:{defaultTransactionLimit:25,showRunningBalance:true,showNotes:false,showAttachment:true,showBusinessAddress:true,showBusinessPhone:true,showBusinessGstin:true,showGeneratedDate:true,showPageNumbers:true,paperSize:"A4",orientation:"portrait",fontSize:"normal",customFooter:""}}};};
    return <Routes><Route path="/company-setup" element={<FirstCompanySetup onCreate={create}/>}/><Route path="*" element={<Navigate to="/company-setup" replace/>}/></Routes>;
  }
  return <LedgerProvider><SettingsProvider><BusinessRoutes/><SettingsAwareToaster/></SettingsProvider></LedgerProvider>;
}

export default function App(){const auth=useAuth();if(auth.loading)return <RouteFallback/>;if(!auth.user)return <Suspense fallback={<RouteFallback/>}><Routes><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<RegisterPage/>}/><Route path="/forgot-password" element={<ForgotPasswordPage/>}/><Route path="/reset-password" element={<ResetPasswordPage/>}/><Route path="*" element={<Navigate to="/login" replace/>}/></Routes></Suspense>;return <Suspense fallback={<RouteFallback/>}><AuthenticatedApp/></Suspense>}
