import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TransactionModalProvider } from "../src/context/TransactionModalContext";
import { SettingsProvider } from "../src/context/SettingsProvider";
import { LedgerContext } from "../src/context/ledger-context";
import type { LedgerContextValue } from "../src/context/ledger-context";
import { AuthContext } from "../src/context/auth-context";
import type { AuthContextValue } from "../src/context/auth-context";
import AddTransactionModal from "../src/components/dashboard/AddTransactionModal";
import EditTransactionModal from "../src/components/transactions/EditTransactionModal";
import ManageCompaniesModal from "../src/components/companies/ManageCompaniesModal";
import FirstCompanySetup from "../src/components/companies/FirstCompanySetup";
import CompanySelection from "../src/pages/CompanySelection/CompanySelection";
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
import { DEFAULT_APPEARANCE_SETTINGS } from "../src/utils/settingsStorage";
import { loadWorkspace } from "../src/utils/workspaceStorage";

const workspace=loadWorkspace(null).workspace;
const successful={ok:true,error:null} as const;
const ledger:LedgerContextValue={companies:workspace.companies,activeCompanyId:workspace.activeCompanyId,activeCompany:workspace.companies[0],companySelectionRequired:false,appearance:{...DEFAULT_APPEARANCE_SETTINGS},parties:workspace.parties,regions:workspace.regions,transactions:workspace.transactions,storageError:null,isPersisted:true,isLoading:false,error:null,activeRole:"OWNER",canWrite:true,isOwner:true,dashboard:null,refreshCompanyData:async()=>undefined,createCompany:async input=>({...workspace.companies[0],...input}),updateCompany:async()=>undefined,canDeleteCompany:()=>true,deleteCompany:async()=>undefined,switchCompany:async()=>undefined,addParty:async input=>({id:99,companyId:1,createdAt:"",...input}),updateParty:async()=>undefined,deleteParty:async()=>undefined,addRegion:async input=>({id:99,companyId:1,...input}),updateRegion:async()=>undefined,deleteRegion:async()=>undefined,addTransaction:async input=>({id:999,companyId:1,createdAt:"",...input}),updateTransaction:async()=>undefined,deleteTransaction:async()=>undefined,downloadAttachment:async()=>undefined,deleteAttachment:async()=>undefined,getPartyBalance:id=>workspace.transactions.filter(t=>t.partyId===id).reduce((sum,t)=>sum+(t.type==="CREDIT"?t.amount:-t.amount),0),getRegionById:id=>workspace.regions.find(r=>r.id===id),resetDemoData:()=>undefined,applySettingsPatch:async()=>successful,clearStorageError:()=>undefined,getWorkspaceSnapshot:()=>workspace,replaceWorkspace:()=>successful};
const auth:AuthContextValue={user:{id:1,name:"Test Owner",email:"owner@example.com"},companies:workspace.companies.map(c=>({...c,role:"OWNER"})),preferences:{rememberLastCompany:false,lastActiveCompanyId:1,appearance:{...DEFAULT_APPEARANCE_SETTINGS}},loading:false,error:null,login:async()=>undefined,register:async()=>undefined,logout:async()=>undefined,forgotPassword:async()=>"Sent",resetPassword:async()=>"Reset",refreshBootstrap:async()=>null,updatePreferences:async()=>auth.preferences!};

function renderPage(element:React.ReactNode,path:string,routePath=path,value=ledger){return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={auth}><LedgerContext.Provider value={value}><SettingsProvider><TransactionModalProvider><Routes><Route path={routePath} element={element}/></Routes></TransactionModalProvider></SettingsProvider></LedgerContext.Provider></AuthContext.Provider></MemoryRouter>)}

const checks=[
  ["Dashboard","/dashboard",<Dashboard/>,["Dashboard","Total Receivable","Recent Transactions"]],
  ["Parties","/parties",<Parties/>,["Parties","ABC Traders","10 per page"]],
  ["Transactions","/transactions",<Transactions/>,["Transactions","Goods supplied","View transaction"]],
  ["Regions","/regions",<Regions/>,["Regions","Punjab"]],
  ["Reports","/reports",<Reports/>,["Reports","Party Statement"]],
  ["Backup","/backup",<Backup/>,["Backup &amp; Restore","Download encrypted backup"]],
  ["Settings","/settings",<Settings/>,["Settings","Business","Appearance"]],
] as const;
for(const [name,path,element,expected] of checks){const markup=renderPage(element,path);for(const text of expected)assert.ok(markup.includes(text),`${name} missing ${text}`)}
assert.ok(renderPage(<PartyDetails/>,"/parties/1","/parties/:partyId").includes("ABC Traders"));
assert.ok(renderPage(<NotFound/>,"/missing","*").includes("Page not found"));

const setup=renderToStaticMarkup(<MemoryRouter><FirstCompanySetup onCreate={async input=>({...workspace.companies[0],...input})}/></MemoryRouter>);for(const text of ["Welcome to LedgerFlow","Create your company","Company Name *","Create Company"])assert.ok(setup.includes(text));
const second={...workspace.companies[0],id:2,name:"Suri Trading"};const multi={...ledger,companies:[workspace.companies[0],second],companySelectionRequired:true};const selection=renderPage(<CompanySelection/>,"/select-company","/select-company",multi);for(const text of ["Welcome back","Suri Trading","Open company","Create company"])assert.ok(selection.includes(text));

const companyManagerProps={open:true,companies:[{...workspace.companies[0],name:"Empty Company"}],activeCompanyId:1,onClose:()=>undefined,onCreate:()=>undefined,onEdit:()=>undefined,onSwitch:()=>undefined,onDelete:()=>undefined};
assert.ok(renderToStaticMarkup(<ManageCompaniesModal {...companyManagerProps} deletableCompanyIds={new Set([1])}/>).includes("Delete company"));
assert.ok(!renderToStaticMarkup(<ManageCompaniesModal {...companyManagerProps} deletableCompanyIds={new Set()}/>).includes(">Delete company<"));

const preferences:StatementPrintPreferences={transactionLimit:20,showRunningBalance:true,showNotes:true,showAttachment:true,showBusinessAddress:true,showBusinessPhone:true,showBusinessGstin:true,showGeneratedDate:true,orientation:"portrait",customFooter:""};
const filters=renderToStaticMarkup(<PartyReportFilters parties={[]} regions={[]} selectedPartyId="" preferences={preferences} customTransactionLimit="20" usesCustomTransactionLimit onTransactionLimitChange={()=>undefined} onPartyChange={()=>undefined} onCustomTransactionLimitChange={()=>undefined} onPreferencesChange={()=>undefined}/>);assert.ok(filters.includes("Custom number"));assert.ok(!filters.includes('type="date"'));
for(const [name,markup] of [["Add",renderPage(<AddTransactionModal open onClose={()=>undefined}/>,"/transactions")],["Edit",renderPage(<EditTransactionModal open transactionId={101} onClose={()=>undefined}/>,"/transactions")]] as const){assert.ok(markup.includes('type="date"'),`${name} needs date`);assert.ok(!markup.includes('datetime-local'));assert.ok(markup.includes('step="1"'))}
for(const limit of ["1","25","100","1000","10000"]){const markup=renderPage(<Reports/>,`/reports?party=1&limit=${limit}&limitMode=custom`,"/reports");assert.ok(markup.includes('<option value="CUSTOM" selected="">'));assert.ok(markup.includes(`value="${limit}"`))}
for(const limit of ["0","10001","1.5","invalid"])assert.ok(renderPage(<Reports/>,`/reports?party=1&limit=${limit}`,"/reports").includes("Invalid transaction limit"));
console.log("LedgerFlow page component smoke checks passed.");
