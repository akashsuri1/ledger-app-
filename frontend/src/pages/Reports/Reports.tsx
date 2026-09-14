import {
  useMemo,
  useState,
  useEffect,
} from "react";
import { reportApi } from "../../api/reportApi";
import type { PartyStatementDto, DateRangeReportDto, RegionReportDto } from "../../api/reportApi";
import { partyApi } from "../../api/partyApi";
import { mapPartyDto } from "../../api/mappers";

import {
  AlertTriangle,
  CalendarRange,
  FileBarChart2,
  MapPinned,
  Printer,
  RotateCcw,
  UserRound,
} from "lucide-react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  useLedger,
} from "../../hooks/useLedger";

import {
  useSettings,
} from "../../hooks/useSettings";

import {
  DateRangeReportFilters,
  PartyReportFilters,
  RegionReportFilters,
} from "../../components/reports/ReportFilters";

import DateRangeReport from "../../components/reports/DateRangeReport";
import PartyStatement from "../../components/reports/PartyStatement";
import RegionReport from "../../components/reports/RegionReport";

import {
  calculateDateRangeReport,
  calculatePartyStatement,
  calculateRegionReport,
  validateReportDateRange,
} from "../../utils/reportCalculations";

import type {
  DateRangePrintPreferences,
  ReportBusinessProfile,
  ReportOrientation,
  StatementPrintPreferences,
} from "../../types/reports";
import type { Party } from "../../types";
import type { PartyStatementResult, DateRangeReportResult, RegionReportResult } from "../../utils/reportCalculations";

import type {
  BusinessSettings,
  PrintSettings,
} from "../../types/settings";

import {
  isPresetTransactionLimit,
  parseTransactionLimit,
} from "../../utils/statementLimits";

type ReportType =
  | "PARTY"
  | "REGION"
  | "DATE_RANGE";

function getBusinessProfile(
  business: BusinessSettings,
): ReportBusinessProfile {
  return {
    name: business.companyName,
    address: business.address,
    phone: business.phone,
    gstin: business.gstin,
    email: business.email,
    statementHeader:
      business.statementHeader,
    statementFooter:
      business.statementFooter,
  };
}

function getStatementPreferences(
  print: PrintSettings,
): StatementPrintPreferences {
  return {
    transactionLimit:
      print.defaultTransactionLimit,
    showRunningBalance:
      print.showRunningBalance,
    showNotes: print.showNotes,
    showAttachment:
      print.showAttachment,
    showBusinessAddress:
      print.showBusinessAddress,
    showBusinessPhone:
      print.showBusinessPhone,
    showBusinessGstin:
      print.showBusinessGstin,
    showGeneratedDate:
      print.showGeneratedDate,
    orientation: print.orientation,
    customFooter:
      print.customFooter,
  };
}

function getDateRangePreferences(
  print: PrintSettings,
): DateRangePrintPreferences {
  return {
    showNotes: print.showNotes,
    showAttachment:
      print.showAttachment,
    showBusinessAddress:
      print.showBusinessAddress,
    showBusinessPhone:
      print.showBusinessPhone,
    showBusinessGstin:
      print.showBusinessGstin,
    showGeneratedDate:
      print.showGeneratedDate,
    orientation: print.orientation,
    customFooter:
      print.customFooter,
  };
}

function parsePositiveId(
  value: string | null,
) {
  if (
    !value ||
    !/^\d+$/.test(value)
  ) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(
    parsed,
  ) && parsed > 0
    ? parsed
    : undefined;
}

function range(from: string | null, to: string | null) {
  return { from: from ?? undefined, to: to ?? undefined, isValid: true, issues: [] };
}

function transactionFromReport(value: { id:number;partyId?:number;transactionDate:string;description:string;notes:string;type:"CREDIT"|"DEBIT";credit:number|null;debit:number|null;attachment:{id:number;originalName:string;mimeType:string;byteSize:number}|null }, companyId:number, fallbackPartyId?:number) {
  return { id:value.id, companyId, partyId:value.partyId ?? fallbackPartyId ?? 0, type:value.type, amount:value.credit ?? value.debit ?? 0, transactionDate:value.transactionDate, description:value.description, notes:value.notes, createdAt:value.transactionDate, attachmentName:value.attachment?.originalName, attachmentId:value.attachment?.id, attachmentMimeType:value.attachment?.mimeType, attachmentByteSize:value.attachment?.byteSize };
}

function statementResult(value: PartyStatementDto, companyId: number): PartyStatementResult {
  return { partyId:value.party.id,dateRange:range(value.from,value.to),requestedLastN:typeof value.limit==="number"?value.limit:undefined,eligibleTransactionCount:value.eligibleTransactionCount,displayedTransactionCount:value.displayedTransactionCount,openingBalance:value.openingBalance,totalCredit:value.totalCredit,totalDebit:value.totalDebit,netMovement:value.netMovement,closingBalance:value.closingBalance,rows:value.transactions.map(item=>({transaction:transactionFromReport(item,companyId,value.party.id),credit:item.credit??0,debit:item.debit??0,signedAmount:item.signedAmount,runningBalance:item.runningBalance})),invalidTransactionIds:[],isValid:true,validationIssues:[] };
}
function dateResult(value: DateRangeReportDto, companyId: number): DateRangeReportResult {
  return { dateRange:range(value.from,value.to),rows:value.transactions.map(item=>({transaction:transactionFromReport(item,companyId),credit:item.credit??0,debit:item.debit??0,signedAmount:item.signedAmount})),transactionCount:value.transactionCount,totalCredit:value.totalCredit,totalDebit:value.totalDebit,netMovement:value.netMovement,invalidTransactionIds:[],isValid:true,validationIssues:[] };
}
function regionResult(value: RegionReportDto, companyId: number, partyList: readonly Party[]): RegionReportResult {
  return { regionId:value.regionId??undefined,dateRange:range(value.from,value.to),rows:value.regions.map(item=>({region:{id:item.id,companyId,name:item.name},partyCount:item.partyCount,transactionCount:item.transactionCount,totalCredit:item.totalCredit,totalDebit:item.totalDebit,openingBalance:item.openingBalance,netMovement:item.netMovement,closingBalance:item.closingBalance,netBalance:item.netBalance,totalReceivable:item.totalReceivable,totalPayable:item.totalPayable,parties:item.parties.map(entry=>({party:partyList.find(p=>p.id===entry.id)??{id:entry.id,companyId,regionId:item.id,name:entry.name,phone:"",address:"",gstin:"",notes:"",createdAt:""},transactionCount:entry.transactionCount,totalCredit:entry.totalCredit,totalDebit:entry.totalDebit,openingBalance:entry.openingBalance,netMovement:entry.netMovement,closingBalance:entry.closingBalance,balance:entry.balance,receivable:entry.receivable,payable:entry.payable}))})),totals:value.totals,invalidTransactionIds:[],isValid:true,validationIssues:[] };
}

function PreviewMessage({
  title,
  description,
  tone = "neutral",
}: {
  title: string;
  description: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="no-print flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div>
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
            tone === "warning"
              ? "bg-amber-50 text-amber-600"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {tone === "warning" ? (
            <AlertTriangle size={22} />
          ) : (
            <FileBarChart2 size={22} />
          )}
        </div>

        <h2 className="mt-4 font-semibold text-slate-950">
          {title}
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function Reports() {
  const navigate =
    useNavigate();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const {
    activeCompanyId,
    parties,
    regions,
    transactions,
  } = useLedger();

  const [serverStatement, setServerStatement] = useState<{ key: string; value: PartyStatementResult }>();
  const [serverDateRange, setServerDateRange] = useState<{ key: string; value: DateRangeReportResult }>();
  const [serverRegions, setServerRegions] = useState<{ key: string; value: RegionReportResult }>();
  const [serverError, setServerError] = useState<{ key: string; message: string }>();
  const [remoteParty, setRemoteParty] = useState<{ key: string; value: Party }>();
  const [remotePartyError, setRemotePartyError] = useState<{ key: string; message: string }>();

  const { settings } =
    useSettings();

  const businessProfile =
    getBusinessProfile(
      settings.business,
    );

  const savedStatementPreferences =
    getStatementPreferences(
      settings.print,
    );

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const [
    customLimitDraft,
    setCustomLimitDraft,
  ] = useState<{ query: string | null; value: string } | null>(null);

  const [
    statementPreferences,
    setStatementPreferences,
  ] = useState(() =>
    getStatementPreferences(
      settings.print,
    ),
  );

  const [
    showPartyBreakdown,
    setShowPartyBreakdown,
  ] = useState(true);

  const [
    regionOrientation,
    setRegionOrientation,
  ] =
    useState<ReportOrientation>(
      settings.print.orientation,
    );

  const [
    dateRangeRegionId,
    setDateRangeRegionId,
  ] = useState("ALL");

  const [
    dateRangePartyId,
    setDateRangePartyId,
  ] = useState("ALL");

  const [
    dateRangePreferences,
    setDateRangePreferences,
  ] = useState(() =>
    getDateRangePreferences(
      settings.print,
    ),
  );

  const [generatedAt, setGeneratedAt] =
    useState(() =>
      new Date().toISOString(),
    );

  const reportTypeValue =
    searchParams
      .get("type")
      ?.trim()
      .toLowerCase();

  const reportType: ReportType =
    reportTypeValue === "region"
      ? "REGION"
      : reportTypeValue ===
            "date-range" ||
          reportTypeValue === "date"
        ? "DATE_RANGE"
        : "PARTY";

  const sortedParties =
    useMemo(
      () =>
        [...parties].sort(
          (left, right) =>
            left.name.localeCompare(
              right.name,
              "en-IN",
            ),
        ),
      [parties],
    );

  const sortedRegions =
    useMemo(
      () =>
        [...regions].sort(
          (left, right) =>
            left.name.localeCompare(
              right.name,
              "en-IN",
            ),
        ),
      [regions],
    );

  const partyQuery =
    searchParams.get("party");

  const partyId =
    parsePositiveId(
      partyQuery,
    );

  const cachedSelectedParty =
    partyId === undefined
      ? undefined
      : parties.find(
          (party) =>
            party.id === partyId,
        );

  const partyLookupKey = `${activeCompanyId}:${partyId ?? "none"}`;

  useEffect(() => {
    if (partyId === undefined || cachedSelectedParty) return;
    const controller = new AbortController();
    partyApi.get(activeCompanyId, partyId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setRemoteParty({ key: partyLookupKey, value: mapPartyDto(value) });
          setRemotePartyError(undefined);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setRemotePartyError({ key: partyLookupKey, message: cause instanceof Error ? cause.message : "That party is unavailable." });
      });
    return () => controller.abort();
  }, [activeCompanyId, cachedSelectedParty, partyId, partyLookupKey]);

  const selectedParty = cachedSelectedParty ?? (remoteParty?.key === partyLookupKey ? remoteParty.value : undefined);

  const partyQueryError =
    partyQuery !== null &&
    !selectedParty
      ? partyId === undefined
        ? "The party query parameter is invalid. Select a party to continue."
        : remotePartyError?.key === partyLookupKey
          ? remotePartyError.message
          : undefined
      : undefined;

  const regionQuery =
    searchParams.get("region");

  const isAllRegionsQuery =
    regionQuery?.trim().toUpperCase() ===
    "ALL";

  const regionId =
    isAllRegionsQuery
      ? undefined
      : parsePositiveId(
          regionQuery,
        );

  const selectedRegion =
    regionId === undefined
      ? undefined
      : regions.find(
          (region) =>
            region.id === regionId,
        );

  const regionQueryError =
    regionQuery !== null &&
    !isAllRegionsQuery &&
    !selectedRegion
      ? regionId === undefined
        ? "The region query parameter is invalid. Choose All regions or select a valid region."
        : "That region no longer exists. Choose another region for this report."
      : undefined;

  const limitQuery =
    searchParams.get("limit");

  const parsedLimit =
    parseTransactionLimit(
      limitQuery,
    );

  const limitQueryError =
    limitQuery !== null &&
    parsedLimit === undefined
      ? "The transaction-count query parameter is invalid. Enter a whole number from 1 to 10,000, or choose All."
      : undefined;

  const effectivePreferences: StatementPrintPreferences = {
    ...statementPreferences,
    transactionLimit:
      parsedLimit ??
      settings.print.defaultTransactionLimit,
  };

  const usesCustomTransactionLimit =
    typeof effectivePreferences.transactionLimit ===
      "number" &&
    (searchParams.get("limitMode") === "custom" ||
      !isPresetTransactionLimit(effectivePreferences.transactionLimit));

  // Keep incomplete input local while keeping valid limits in shareable URLs.
  // A different URL must not reuse a draft from the previous statement.
  if (customLimitDraft && customLimitDraft.query !== limitQuery) {
    setCustomLimitDraft(null);
  }

  const customTransactionLimit =
    customLimitDraft?.query === limitQuery
      ? customLimitDraft.value
      : typeof parsedLimit === "number"
        ? parsedLimit.toString()
        : "20";

  const parsedCustomTransactionLimit =
    parseTransactionLimit(
      customTransactionLimit,
    );

  const customTransactionLimitError =
    usesCustomTransactionLimit &&
    typeof parsedCustomTransactionLimit !==
      "number"
      ? "Enter a whole number of transactions from 1 to 10,000."
      : undefined;

  const regionPreferences: StatementPrintPreferences = {
    ...savedStatementPreferences,
    orientation:
      regionOrientation,
  };

  const selectedDateRangeRegion =
    dateRangeRegionId === "ALL"
      ? undefined
      : regions.find(
          (region) =>
            region.id ===
            parsePositiveId(
              dateRangeRegionId,
            ),
        );

  const dateRangePartyOptions =
    useMemo(
      () =>
        selectedDateRangeRegion
          ? sortedParties.filter(
              (party) =>
                party.regionId ===
                selectedDateRangeRegion.id,
            )
          : sortedParties,
      [
        selectedDateRangeRegion,
        sortedParties,
      ],
    );

  const selectedDateRangeParty =
    dateRangePartyId === "ALL"
      ? undefined
      : dateRangePartyOptions.find(
          (party) =>
            party.id ===
            parsePositiveId(
              dateRangePartyId,
            ),
        );

  const dateRangePartyIds =
    useMemo(
      () =>
        selectedDateRangeParty
          ? [
              selectedDateRangeParty.id,
            ]
          : selectedDateRangeRegion
            ? dateRangePartyOptions.map(
                (party) =>
                  party.id,
              )
            : undefined,
      [
        selectedDateRangeParty,
        selectedDateRangeRegion,
        dateRangePartyOptions,
      ],
    );

  const dateValidation =
    useMemo(
      () =>
        validateReportDateRange({
          from: fromDate,
          to: toDate,
        }),
      [fromDate, toDate],
    );

  const statementKey = `${activeCompanyId}:${selectedParty?.id ?? "none"}:${fromDate}:${toDate}:${effectivePreferences.transactionLimit}`;
  const regionReportKey = `${activeCompanyId}:${selectedRegion?.id ?? "all"}:${fromDate}:${toDate}`;
  const dateRangeReportKey = `${activeCompanyId}:${selectedDateRangeRegion?.id ?? "all"}:${selectedDateRangeParty?.id ?? "all"}:${fromDate}:${toDate}`;
  const activeReportKey = reportType === "PARTY" ? statementKey : reportType === "REGION" ? regionReportKey : dateRangeReportKey;

  useEffect(() => {
    let current = true;
    if (reportType === "PARTY" && selectedParty) {
      void reportApi.partyStatement(activeCompanyId, { partyId:selectedParty.id, from:fromDate||undefined, to:toDate||undefined, limit:effectivePreferences.transactionLimit }).then(value=>{if(current){setServerStatement({key:statementKey,value:statementResult(value,activeCompanyId)});setServerError(undefined)}}).catch(cause=>{if(current)setServerError({key:statementKey,message:cause instanceof Error?cause.message:"Unable to load the statement."})});
    } else if (reportType === "REGION") {
      void reportApi.regions(activeCompanyId, { regionId:selectedRegion?.id, from:fromDate||undefined, to:toDate||undefined }).then(value=>{if(current){setServerRegions({key:regionReportKey,value:regionResult(value,activeCompanyId,parties)});setServerError(undefined)}}).catch(cause=>{if(current)setServerError({key:regionReportKey,message:cause instanceof Error?cause.message:"Unable to load the region report."})});
    } else if (reportType === "DATE_RANGE") {
      void reportApi.dateRange(activeCompanyId, { regionId:selectedDateRangeRegion?.id, partyId:selectedDateRangeParty?.id, from:fromDate||undefined, to:toDate||undefined }).then(value=>{if(current){setServerDateRange({key:dateRangeReportKey,value:dateResult(value,activeCompanyId)});setServerError(undefined)}}).catch(cause=>{if(current)setServerError({key:dateRangeReportKey,message:cause instanceof Error?cause.message:"Unable to load the date-range report."})});
    }
    return () => { current=false; };
  }, [activeCompanyId, dateRangeReportKey, effectivePreferences.transactionLimit, fromDate, parties, regionReportKey, reportType, selectedDateRangeParty?.id, selectedDateRangeRegion?.id, selectedParty, selectedRegion?.id, statementKey, toDate]);

  const calculatedStatement =
    useMemo(
      () =>
        selectedParty
          ? calculatePartyStatement({
              partyId:
                selectedParty.id,
              transactions,
              lastN:
                effectivePreferences.transactionLimit ===
                "ALL"
                  ? undefined
                  : effectivePreferences.transactionLimit,
            })
          : undefined,
      [
        selectedParty,
        transactions,
        effectivePreferences.transactionLimit,
      ],
    );
  const statement = serverStatement?.key === statementKey ? serverStatement.value : calculatedStatement;

  const calculatedRegionReport =
    useMemo(
      () =>
        calculateRegionReport({
          regions,
          parties,
          transactions,
          regionId:
            selectedRegion?.id,
          from:
            fromDate ||
            undefined,
          to:
            toDate || undefined,
        }),
      [
        regions,
        parties,
        transactions,
        selectedRegion,
        fromDate,
        toDate,
      ],
    );
  const regionReport = serverRegions?.key === regionReportKey ? serverRegions.value : calculatedRegionReport;

  const calculatedDateRangeReport =
    useMemo(
      () =>
        calculateDateRangeReport({
          transactions,
          partyIds:
            dateRangePartyIds,
          from:
            fromDate || undefined,
          to:
            toDate || undefined,
        }),
      [
        transactions,
        dateRangePartyIds,
        fromDate,
        toDate,
      ],
    );
  const dateRangeReport = serverDateRange?.key === dateRangeReportKey ? serverDateRange.value : calculatedDateRangeReport;

  const selectedPartyRegion =
    selectedParty
      ? regions.find(
          (region) =>
            region.id ===
            selectedParty.regionId,
        )
      : undefined;

  const validationMessages = [
    serverError?.key === activeReportKey ? serverError.message : undefined,
    ...(reportType === "PARTY"
      ? []
      : dateValidation.issues.map(
          (issue) => issue.message,
        )),
    ...(reportType === "PARTY"
      ? [
          partyQueryError,
          limitQueryError,
          customTransactionLimitError,
        ]
      : reportType === "REGION"
        ? [regionQueryError]
        : []),
  ].filter(
    (message): message is string =>
      Boolean(message),
  );

  const canPrint =
    validationMessages.length === 0 &&
    (reportType === "PARTY"
      ? Boolean(
          selectedParty &&
            statement?.isValid,
        )
      : reportType === "REGION"
        ? regionReport.isValid &&
          regionReport.rows.length > 0
        : dateRangeReport.isValid &&
          dateRangeReport.rows.length > 0);

  function updateQuery(
    changes: Record<
      string,
      string | undefined
    >,
  ) {
    const next =
      new URLSearchParams(
        searchParams,
      );

    Object.entries(changes).forEach(
      ([key, value]) => {
        if (value === undefined) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      },
    );

    setSearchParams(next, {
      replace: true,
    });
  }

  function selectReportType(
    type: ReportType,
  ) {
    if (type === "PARTY") {
      updateQuery({
        type: "party",
        region: undefined,
      });
      return;
    }

    updateQuery({
      type:
        type === "REGION"
          ? "region"
          : "date-range",
      party: undefined,
      region: undefined,
      limit: undefined,
      limitMode: undefined,
    });
  }

  function handlePreferenceChange(
    preferences: StatementPrintPreferences,
  ) {
    setStatementPreferences(
      preferences,
    );
  }

  function handleTransactionLimitChange(value: string) {
    if (value === "CUSTOM") {
      handleCustomTransactionLimitChange(
        typeof parseTransactionLimit(customTransactionLimit) === "number"
          ? customTransactionLimit
          : "20",
      );
      return;
    }

    setCustomLimitDraft(null);
    updateQuery({ limit: value.toLowerCase(), limitMode: undefined });
  }

  function handleCustomTransactionLimitChange(
    value: string,
  ) {
    const parsed =
      parseTransactionLimit(value);

    setCustomLimitDraft({
      query: typeof parsed === "number" ? parsed.toString() : limitQuery,
      value,
    });

    if (typeof parsed !== "number") {
      return;
    }

    updateQuery({
      limit: parsed.toString(),
      limitMode: "custom",
    });
  }

  function resetFilters() {
    setFromDate("");
    setToDate("");

    if (reportType === "PARTY") {
      setCustomLimitDraft(null);
      setStatementPreferences(
        getStatementPreferences(
          settings.print,
        ),
      );
      updateQuery({
        limit: undefined,
        limitMode: undefined,
        ...(partyQueryError
          ? {
              party: undefined,
            }
          : {}),
      });
    } else if (
      reportType === "REGION"
    ) {
      setShowPartyBreakdown(
        true,
      );
      setRegionOrientation(
        settings.print.orientation,
      );
      if (regionQueryError) {
        updateQuery({
          region: undefined,
        });
      }
    } else {
      setDateRangeRegionId(
        "ALL",
      );
      setDateRangePartyId(
        "ALL",
      );
      setDateRangePreferences(
        getDateRangePreferences(
          settings.print,
        ),
      );
    }
  }

  function printReport() {
    if (!canPrint) {
      return;
    }

    setGeneratedAt(
      new Date().toISOString(),
    );

    window.requestAnimationFrame(
      () => window.print(),
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="no-print flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Financial reporting
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Reports
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Prepare party statements, date-range transaction reports, and regional balance reports.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <RotateCcw size={16} />
            Reset options
          </button>

          <button
            type="button"
            disabled={!canPrint}
            onClick={printReport}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer size={17} />
            Print report
          </button>
        </div>
      </div>

      <div
        aria-label="Report type"
        className="no-print mt-7 grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:max-w-3xl sm:grid-cols-3"
      >
        <button
          type="button"
          aria-pressed={
            reportType === "PARTY"
          }
          onClick={() =>
            selectReportType(
              "PARTY",
            )
          }
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
            reportType === "PARTY"
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <UserRound size={17} />
          Party Statement
        </button>

        <button
          type="button"
          aria-pressed={
            reportType === "REGION"
          }
          onClick={() =>
            selectReportType(
              "REGION",
            )
          }
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
            reportType === "REGION"
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <MapPinned size={17} />
          Region Report
        </button>

        <button
          type="button"
          aria-pressed={
            reportType ===
            "DATE_RANGE"
          }
          onClick={() =>
            selectReportType(
              "DATE_RANGE",
            )
          }
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
            reportType ===
            "DATE_RANGE"
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <CalendarRange size={17} />
          Date Range
        </button>
      </div>

      <section className="no-print mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {reportType === "PARTY" ? (
          <PartyReportFilters
            parties={sortedParties}
            regions={sortedRegions}
            selectedPartyId={
              selectedParty?.id.toString() ??
              ""
            }
            preferences={
              effectivePreferences
            }
            customTransactionLimit={
              customTransactionLimit
            }
            usesCustomTransactionLimit={usesCustomTransactionLimit}
            onTransactionLimitChange={handleTransactionLimitChange}
            partySelectionInvalid={
              Boolean(
                partyQueryError,
              )
            }
            transactionLimitInvalid={
              Boolean(
                limitQueryError ||
                  customTransactionLimitError,
              )
            }
            validationErrorId="report-validation-errors"
            onPartyChange={(value) =>
              updateQuery({
                type: "party",
                party:
                  value || undefined,
              })
            }
            onCustomTransactionLimitChange={
              handleCustomTransactionLimitChange
            }
            onPreferencesChange={
              handlePreferenceChange
            }
          />
        ) : reportType ===
          "REGION" ? (
          <RegionReportFilters
            regions={sortedRegions}
            selectedRegionId={
              selectedRegion?.id.toString() ??
              "ALL"
            }
            fromDate={fromDate}
            toDate={toDate}
            showPartyBreakdown={
              showPartyBreakdown
            }
            orientation={
              regionOrientation
            }
            regionSelectionInvalid={
              Boolean(
                regionQueryError,
              )
            }
            dateRangeInvalid={
              !dateValidation.isValid
            }
            validationErrorId="report-validation-errors"
            onRegionChange={(value) =>
              updateQuery({
                type: "region",
                region:
                  value === "ALL"
                    ? undefined
                    : value,
              })
            }
            onFromDateChange={
              setFromDate
            }
            onToDateChange={
              setToDate
            }
            onShowPartyBreakdownChange={
              setShowPartyBreakdown
            }
            onOrientationChange={
              setRegionOrientation
            }
          />
        ) : (
          <DateRangeReportFilters
            parties={
              dateRangePartyOptions
            }
            regions={sortedRegions}
            selectedPartyId={
              selectedDateRangeParty?.id.toString() ??
              "ALL"
            }
            selectedRegionId={
              selectedDateRangeRegion?.id.toString() ??
              "ALL"
            }
            fromDate={fromDate}
            toDate={toDate}
            preferences={
              dateRangePreferences
            }
            dateRangeInvalid={
              !dateValidation.isValid
            }
            validationErrorId="report-validation-errors"
            onPartyChange={
              setDateRangePartyId
            }
            onRegionChange={(value) => {
              setDateRangeRegionId(
                value,
              );
              setDateRangePartyId(
                "ALL",
              );
            }}
            onFromDateChange={
              setFromDate
            }
            onToDateChange={
              setToDate
            }
            onPreferencesChange={
              setDateRangePreferences
            }
          />
        )}
      </section>

      {validationMessages.length > 0 && (
        <div
          id="report-validation-errors"
          role="alert"
          className="no-print mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          <div className="flex gap-3">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-semibold">
                Check report options
              </p>

              <ul className="mt-1 list-disc space-y-1 pl-4">
                {validationMessages.map(
                  (message) => (
                    <li key={message}>
                      {message}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="report-preview-shell mt-6 rounded-2xl bg-slate-200/70 p-3 sm:p-6">
        {reportType === "PARTY" ? (
          partyQueryError ? (
            <PreviewMessage
              title="Party unavailable"
              description={partyQueryError}
              tone="warning"
            />
          ) : !selectedParty ? (
            <PreviewMessage
              title="Select a party"
              description="Choose a party above to generate an accounting-correct statement and print preview."
            />
          ) : limitQueryError || customTransactionLimitError ? (
            <PreviewMessage
              title="Invalid transaction limit"
              description={limitQueryError || customTransactionLimitError!}
              tone="warning"
            />
          ) : !statement?.isValid ? (
            <PreviewMessage
              title="Statement cannot be generated"
              description={
                statement?.validationIssues
                  .map(
                    (issue) =>
                      issue.message,
                  )
                  .join(" ") ||
                "Check the selected report options."
              }
              tone="warning"
            />
          ) : (
            <PartyStatement
              party={selectedParty}
              region={
                selectedPartyRegion
              }
              statement={statement}
              business={
                businessProfile
              }
              preferences={
                effectivePreferences
              }
              generatedAt={generatedAt}
            />
          )
        ) : reportType ===
          "REGION" ? (
          regionQueryError ? (
            <PreviewMessage
              title="Region unavailable"
              description={regionQueryError}
              tone="warning"
            />
          ) : !regionReport.isValid ? (
            <PreviewMessage
              title="Report cannot be generated"
              description={regionReport.validationIssues
                .map(
                  (issue) =>
                    issue.message,
                )
                .join(" ")}
              tone="warning"
            />
          ) : (
            <RegionReport
              report={regionReport}
              business={
                businessProfile
              }
              showPartyBreakdown={
                showPartyBreakdown
              }
              preferences={
                regionPreferences
              }
              generatedAt={generatedAt}
              onPartyClick={(partyIdValue) =>
                navigate(
                  `/parties/${partyIdValue}`,
                )
              }
            />
          )
        ) : (
          <DateRangeReport
            report={dateRangeReport}
            parties={parties}
            regions={regions}
            business={
              businessProfile
            }
            preferences={
              dateRangePreferences
            }
            generatedAt={generatedAt}
          />
        )}
      </div>

    </div>
  );
}
