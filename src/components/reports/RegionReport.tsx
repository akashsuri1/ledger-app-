import type {
  ReportBusinessProfile,
  StatementPrintPreferences,
} from "../../types/reports";

import type {
  RegionReportResult,
} from "../../utils/reportCalculations";

import {
  formatBalanceLabel,
  formatReportDateRange,
  formatReportTransactionDate,
} from "../../utils/reportFormatting";

import {
  formatCurrency,
} from "../../utils/currency";

import PrintPreview from "./PrintPreview";

interface RegionReportProps {
  report: RegionReportResult;
  business: ReportBusinessProfile;
  showPartyBreakdown: boolean;
  preferences: StatementPrintPreferences;
  generatedAt: string;
  onPartyClick: (partyId: number) => void;
}

function balanceTone(
  balance: number,
) {
  if (balance > 0) {
    return "text-emerald-700";
  }

  if (balance < 0) {
    return "text-rose-700";
  }

  return "text-slate-700";
}

export default function RegionReport({
  report,
  business,
  showPartyBreakdown,
  preferences,
  generatedAt,
  onPartyClick,
}: RegionReportProps) {
  const hasDateFilter =
    Boolean(
      report.dateRange.from ||
        report.dateRange.to,
    );
  const hasOpeningBalance =
    Boolean(
      report.dateRange.from,
    );
  const footerText =
    preferences.customFooter.trim() ||
    business.statementFooter.trim();

  return (
    <PrintPreview
      orientation={preferences.orientation}
    >
      <article>
        <header className="report-section border-b-2 border-slate-900 pb-5">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-sm font-bold text-slate-700">
                  LF
                </div>

                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-950">
                    {business.name.trim() ||
                      "Business Ledger"}
                  </h1>

                  <p className="text-xs text-slate-500">
                    {business.statementHeader.trim() ||
                      "Professional accounting reports"}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-0.5 text-xs leading-5 text-slate-600">
                {preferences.showBusinessAddress &&
                  business.address.trim() && (
                    <p>{business.address}</p>
                  )}

                {preferences.showBusinessPhone &&
                  business.phone.trim() && (
                    <p>Phone: {business.phone}</p>
                  )}

                {preferences.showBusinessGstin &&
                  business.gstin.trim() && (
                    <p>GSTIN: {business.gstin}</p>
                  )}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Region Report
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {formatReportDateRange(
                  report.dateRange.from,
                  report.dateRange.to,
                )}
              </p>

              {hasDateFilter && (
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                  Credit and debit show period activity. Receivable, payable, and net figures are closing balances including prior history.
                </p>
              )}
            </div>
          </div>
        </header>

        {report.invalidTransactionIds.length >
          0 && (
          <div className="report-section mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {report.invalidTransactionIds.length}{" "}
            transaction(s) with invalid dates were omitted from this report.
          </div>
        )}

        <section className="report-section mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Regions
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {report.totals.regionCount}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Parties
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {report.totals.partyCount}
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Receivable
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-700">
              {formatCurrency(
                report.totals.totalReceivable,
              )}
            </p>
          </div>

          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">
              Payable
            </p>
            <p className="mt-1 text-lg font-bold text-rose-700">
              {formatCurrency(
                report.totals.totalPayable,
              )}
            </p>
          </div>
        </section>

        <section className="report-table-wrap mt-5 overflow-x-auto">
          <table className="report-table w-full border-collapse text-left text-xs">
            <caption className="sr-only">
              Closing balances by region
            </caption>

            <thead>
              <tr className="border-y border-slate-300 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
                <th
                  scope="col"
                  className="px-3 py-2.5 font-semibold"
                >
                  Region
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right font-semibold"
                >
                  Parties
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right font-semibold"
                >
                  Receivable
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right font-semibold"
                >
                  Payable
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right font-semibold"
                >
                  Net Balance
                </th>
              </tr>
            </thead>

            <tbody>
              {report.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="border-b border-slate-200 px-3 py-10 text-center text-sm text-slate-500"
                  >
                    No regions are available for this report.
                  </td>
                </tr>
              ) : (
                report.rows.map((row) => (
                  <tr
                    key={row.region.id}
                    className="report-row border-b border-slate-200"
                  >
                    <th
                      scope="row"
                      className="px-3 py-3 text-left font-semibold text-slate-800"
                    >
                      {row.region.name}
                    </th>
                    <td className="px-3 py-3 text-right text-slate-600">
                      {row.partyCount}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-emerald-700">
                      {formatCurrency(
                        row.totalReceivable,
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-rose-700">
                      {formatCurrency(
                        row.totalPayable,
                      )}
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-semibold ${balanceTone(
                        row.netBalance,
                      )}`}
                    >
                      {formatBalanceLabel(
                        row.netBalance,
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {report.rows.length > 0 && (
              <tfoot>
                <tr className="border-y-2 border-slate-900 bg-slate-50 font-bold">
                  <th
                    scope="row"
                    className="px-3 py-3 text-left text-slate-950"
                  >
                    Total
                  </th>
                  <td className="px-3 py-3 text-right text-slate-800">
                    {report.totals.partyCount}
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-700">
                    {formatCurrency(
                      report.totals.totalReceivable,
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-rose-700">
                    {formatCurrency(
                      report.totals.totalPayable,
                    )}
                  </td>
                  <td
                    className={`px-3 py-3 text-right ${balanceTone(
                      report.totals.netBalance,
                    )}`}
                  >
                    {formatBalanceLabel(
                      report.totals.netBalance,
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </section>

        {showPartyBreakdown &&
          report.rows.map((row) => (
            <section
              key={row.region.id}
              className="mt-7"
            >
              <div className="report-section mb-2 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-950">
                    {row.region.name} — Party Breakdown
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {row.partyCount}{" "}
                    {row.partyCount === 1
                      ? "party"
                      : "parties"}
                    , {row.transactionCount}{" "}
                    transactions
                  </p>
                </div>
              </div>

              <div className="report-table-wrap overflow-x-auto">
                <table className="report-table w-full border-collapse text-left text-xs">
                  <caption className="sr-only">
                    Party closing balances for {row.region.name}
                  </caption>

                  <thead>
                    <tr className="border-y border-slate-300 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <th
                        scope="col"
                        className="px-3 py-2 font-semibold"
                      >
                        Party
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right font-semibold"
                      >
                        Entries
                      </th>

                      {hasOpeningBalance && (
                        <th
                          scope="col"
                          className="px-3 py-2 text-right font-semibold"
                        >
                          Opening
                        </th>
                      )}

                      <th
                        scope="col"
                        className="px-3 py-2 text-right font-semibold"
                      >
                        Credit
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right font-semibold"
                      >
                        Debit
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-right font-semibold"
                      >
                        Closing Balance
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {row.parties.length === 0 ? (
                      <tr>
                        <td
                          colSpan={
                            hasOpeningBalance
                              ? 6
                              : 5
                          }
                          className="border-b border-slate-200 px-3 py-6 text-center text-slate-500"
                        >
                          No parties in this region.
                        </td>
                      </tr>
                    ) : (
                      row.parties.map(
                        (partyRow) => (
                          <tr
                            key={partyRow.party.id}
                            className="report-row border-b border-slate-200"
                          >
                            <th
                              scope="row"
                              className="px-3 py-2.5 text-left"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  onPartyClick(
                                    partyRow.party.id,
                                  )
                                }
                                className="report-party-link font-semibold text-blue-700 hover:underline"
                              >
                                {partyRow.party.name}
                              </button>
                            </th>
                            <td className="px-3 py-2.5 text-right text-slate-600">
                              {partyRow.transactionCount}
                            </td>

                            {hasOpeningBalance && (
                              <td
                                className={`px-3 py-2.5 text-right ${balanceTone(
                                  partyRow.openingBalance,
                                )}`}
                              >
                                {formatBalanceLabel(
                                  partyRow.openingBalance,
                                )}
                              </td>
                            )}

                            <td className="px-3 py-2.5 text-right text-emerald-700">
                              {formatCurrency(
                                partyRow.totalCredit,
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right text-rose-700">
                              {formatCurrency(
                                partyRow.totalDebit,
                              )}
                            </td>
                            <td
                              className={`px-3 py-2.5 text-right font-semibold ${balanceTone(
                                partyRow.closingBalance,
                              )}`}
                            >
                              {formatBalanceLabel(
                                partyRow.closingBalance,
                              )}
                            </td>
                          </tr>
                        ),
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

        <footer className="report-section mt-10 border-t border-slate-300 pt-3 text-[10px] leading-5 text-slate-500">
          {footerText && (
            <p className="font-medium text-slate-600">
              {footerText}
            </p>
          )}

          {preferences.showGeneratedDate && (
            <p>
              Generated {formatReportTransactionDate(
                generatedAt,
                true,
              )}
            </p>
          )}
        </footer>
      </article>
    </PrintPreview>
  );
}
