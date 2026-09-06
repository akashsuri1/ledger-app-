import type {
  Party,
  Region,
} from "../../types";

import type {
  DateRangePrintPreferences,
  ReportBusinessProfile,
} from "../../types/reports";

import type {
  DateRangeReportResult,
} from "../../utils/reportCalculations";

import {
  formatReportDateRange,
  formatReportTransactionDate,
} from "../../utils/reportFormatting";

import {
  formatCurrency,
} from "../../utils/currency";

import PrintPreview from "./PrintPreview";

interface DateRangeReportProps {
  report: DateRangeReportResult;
  parties: readonly Party[];
  regions: readonly Region[];
  business: ReportBusinessProfile;
  preferences: DateRangePrintPreferences;
  generatedAt: string;
}

function movementTone(
  movement: number,
) {
  if (movement > 0) {
    return "text-emerald-700";
  }

  if (movement < 0) {
    return "text-rose-700";
  }

  return "text-slate-700";
}

export default function DateRangeReport({
  report,
  parties,
  regions,
  business,
  preferences,
  generatedAt,
}: DateRangeReportProps) {
  const partiesById = new Map(
    parties.map((party) => [
      party.id,
      party,
    ]),
  );
  const regionsById = new Map(
    regions.map((region) => [
      region.id,
      region,
    ]),
  );
  const columnCount =
    6 +
    Number(preferences.showNotes) +
    Number(
      preferences.showAttachment,
    );
  const footerText =
    preferences.customFooter.trim() ||
    business.statementFooter.trim();
  const showBusinessAddress =
    preferences.showBusinessAddress;
  const showBusinessPhone =
    preferences.showBusinessPhone;
  const showBusinessGstin =
    preferences.showBusinessGstin;
  const showGeneratedDate =
    preferences.showGeneratedDate;

  return (
    <PrintPreview
      orientation={preferences.orientation}
    >
      <article
        aria-labelledby="date-range-report-title"
      >
        <header className="report-section border-b-2 border-slate-900 pb-5">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-sm font-bold text-slate-700"
                >
                  LF
                </div>

                <div>
                  <h1
                    id="date-range-report-title"
                    className="text-xl font-bold tracking-tight text-slate-950"
                  >
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
                {showBusinessAddress &&
                  business.address.trim() && (
                    <p>{business.address}</p>
                  )}

                {showBusinessPhone &&
                  business.phone.trim() && (
                    <p>
                      Phone: {business.phone}
                    </p>
                  )}

                {showBusinessGstin &&
                  business.gstin.trim() && (
                    <p>
                      GSTIN: {business.gstin}
                    </p>
                  )}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Date Range Report
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                {formatReportDateRange(
                  report.dateRange.from,
                  report.dateRange.to,
                )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {report.rows.length}{" "}
                transaction(s)
              </p>
            </div>
          </div>
        </header>

        {!report.isValid && (
          <section
            role="alert"
            className="report-section mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
          >
            <p className="font-semibold">
              This report cannot be generated with the selected filters.
            </p>

            {report.validationIssues.length >
              0 && (
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {report.validationIssues.map(
                  (issue, index) => (
                    <li
                      key={`${issue.message}-${index}`}
                    >
                      {issue.message}
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        )}

        {report.invalidTransactionIds.length >
          0 && (
          <div
            role="status"
            className="report-section mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
          >
            {report.invalidTransactionIds.length}{" "}
            transaction(s) with invalid dates were omitted from this report.
          </div>
        )}

        <section className="report-section mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Total Credit
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-700">
              {formatCurrency(
                report.totalCredit,
              )}
            </p>
          </div>

          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">
              Total Debit
            </p>
            <p className="mt-1 text-lg font-bold text-rose-700">
              {formatCurrency(
                report.totalDebit,
              )}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Net Movement
            </p>
            <p
              className={`mt-1 text-lg font-bold ${movementTone(
                report.netMovement,
              )}`}
            >
              {formatCurrency(
                report.netMovement,
              )}
            </p>
          </div>
        </section>

        <section className="report-table-wrap mt-5 overflow-x-auto">
          <table className="report-table w-full border-collapse text-left text-xs">
            <caption className="sr-only">
              Transactions included in the selected date range
            </caption>

            <thead>
              <tr className="border-y border-slate-300 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
                <th
                  scope="col"
                  className="px-2.5 py-2.5 font-semibold"
                >
                  {preferences.showTransactionTime
                    ? "Date & Time"
                    : "Date"}
                </th>

                <th
                  scope="col"
                  className="px-2.5 py-2.5 font-semibold"
                >
                  Party
                </th>

                <th
                  scope="col"
                  className="px-2.5 py-2.5 font-semibold"
                >
                  Region
                </th>

                <th
                  scope="col"
                  className="px-2.5 py-2.5 font-semibold"
                >
                  Description
                </th>

                {preferences.showNotes && (
                  <th
                    scope="col"
                    className="px-2.5 py-2.5 font-semibold"
                  >
                    Notes
                  </th>
                )}

                {preferences.showAttachment && (
                  <th
                    scope="col"
                    className="px-2.5 py-2.5 font-semibold"
                  >
                    Attachment / Invoice
                  </th>
                )}

                <th
                  scope="col"
                  className="px-2.5 py-2.5 text-right font-semibold"
                >
                  Credit
                </th>

                <th
                  scope="col"
                  className="px-2.5 py-2.5 text-right font-semibold"
                >
                  Debit
                </th>
              </tr>
            </thead>

            <tbody>
              {!report.isValid ||
              report.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="border-b border-slate-200 px-3 py-10 text-center text-sm text-slate-500"
                  >
                    {report.isValid
                      ? "No transactions match the selected date range."
                      : "Correct the report filters to view transactions."}
                  </td>
                </tr>
              ) : (
                report.rows.map((row) => {
                  const party =
                    partiesById.get(
                      row.transaction.partyId,
                    );
                  const region = party
                    ? regionsById.get(
                        party.regionId,
                      )
                    : undefined;

                  return (
                    <tr
                      key={row.transaction.id}
                      className="report-row border-b border-slate-200 align-top"
                    >
                      <td className="whitespace-nowrap px-2.5 py-3 text-slate-600">
                        {formatReportTransactionDate(
                          row.transaction.transactionDateTime,
                          preferences.showTransactionTime,
                        )}
                      </td>

                      <th
                        scope="row"
                        className="min-w-32 px-2.5 py-3 text-left font-semibold text-slate-800"
                      >
                        {party?.name ??
                          `Unknown party #${row.transaction.partyId}`}
                      </th>

                      <td className="min-w-24 px-2.5 py-3 text-slate-600">
                        {region?.name ??
                          "Unknown region"}
                      </td>

                      <td className="min-w-36 px-2.5 py-3 font-medium text-slate-800">
                        {row.transaction.description ||
                          "—"}
                      </td>

                      {preferences.showNotes && (
                        <td className="max-w-44 px-2.5 py-3 text-slate-600">
                          {row.transaction.notes ||
                            "—"}
                        </td>
                      )}

                      {preferences.showAttachment && (
                        <td className="max-w-40 break-words px-2.5 py-3 text-slate-600">
                          {row.transaction.attachmentName ||
                            "—"}
                        </td>
                      )}

                      <td className="whitespace-nowrap px-2.5 py-3 text-right font-semibold text-emerald-700">
                        {row.credit > 0
                          ? formatCurrency(
                              row.credit,
                            )
                          : ""}
                      </td>

                      <td className="whitespace-nowrap px-2.5 py-3 text-right font-semibold text-rose-700">
                        {row.debit > 0
                          ? formatCurrency(
                              row.debit,
                            )
                          : ""}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {report.isValid &&
              report.rows.length > 0 && (
              <tfoot>
                <tr className="border-y-2 border-slate-900 bg-slate-50 font-bold">
                  <th
                    scope="row"
                    colSpan={
                      columnCount - 2
                    }
                    className="px-2.5 py-3 text-left text-slate-950"
                  >
                    Total
                  </th>
                  <td className="whitespace-nowrap px-2.5 py-3 text-right text-emerald-700">
                    {formatCurrency(
                      report.totalCredit,
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3 text-right text-rose-700">
                    {formatCurrency(
                      report.totalDebit,
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </section>

        <footer className="report-section mt-10 border-t border-slate-300 pt-3 text-[10px] leading-5 text-slate-500">
          {footerText && (
            <p className="font-medium text-slate-600">
              {footerText}
            </p>
          )}

          {showGeneratedDate && (
            <p>
              Generated{" "}
              {formatReportTransactionDate(
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
