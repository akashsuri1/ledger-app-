import type {
  Party,
  Region,
} from "../../types";

import type {
  ReportBusinessProfile,
  StatementPrintPreferences,
} from "../../types/reports";

import type {
  PartyStatementResult,
} from "../../utils/reportCalculations";

import {
  formatBalanceLabel,
  formatReportGeneratedDateTime,
  formatReportTransactionDate,
} from "../../utils/reportFormatting";

import {
  formatCurrency,
} from "../../utils/currency";

import PrintPreview from "./PrintPreview";

interface PartyStatementProps {
  party: Party;
  region?: Region;
  statement: PartyStatementResult;
  business: ReportBusinessProfile;
  preferences: StatementPrintPreferences;
  generatedAt: string;
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

export default function PartyStatement({
  party,
  region,
  statement,
  business,
  preferences,
  generatedAt,
}: PartyStatementProps) {
  const columnCount =
    4 +
    Number(
      preferences.showNotes,
    ) +
    Number(
      preferences.showAttachment,
    ) +
    Number(
      preferences.showRunningBalance,
    );

  const footerText =
    preferences.customFooter.trim() ||
    business.statementFooter.trim();

  const limitLabel =
    preferences.transactionLimit ===
    "ALL"
      ? "All transactions"
      : `Last ${preferences.transactionLimit} transactions`;

  return (
    <PrintPreview
      orientation={
        preferences.orientation
      }
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
                      "Professional account statement"}
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
                    <p>
                      Phone: {business.phone}
                    </p>
                  )}

                {preferences.showBusinessGstin &&
                  business.gstin.trim() && (
                    <p>
                      GSTIN: {business.gstin}
                    </p>
                  )}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Party Statement
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-900">
                Complete ledger history
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {limitLabel}
              </p>
            </div>
          </div>
        </header>

        <section className="report-section mt-5 grid gap-4 border-b border-slate-200 pb-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Statement for
            </p>

            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {party.name}
            </h2>

            {party.address && (
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {party.address}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs sm:justify-self-end">
            <dt className="text-slate-400">
              Region
            </dt>
            <dd className="text-right font-medium text-slate-700">
              {region?.name ??
                "Unknown region"}
            </dd>

            <dt className="text-slate-400">
              Phone
            </dt>
            <dd className="text-right font-medium text-slate-700">
              {party.phone || "—"}
            </dd>

            <dt className="text-slate-400">
              GSTIN
            </dt>
            <dd className="text-right font-medium text-slate-700">
              {party.gstin || "—"}
            </dd>
          </dl>
        </section>

        <section className="report-section mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Opening Balance
              </p>

              <p
                className={`mt-1 text-base font-semibold ${balanceTone(
                  statement.openingBalance,
                )}`}
              >
                {formatBalanceLabel(
                  statement.openingBalance,
                )}
              </p>
            </div>

            <p className="max-w-md text-xs leading-5 text-slate-500 sm:text-right">
              Opening balance includes all ledger activity before the first transaction shown below.
            </p>
          </div>
        </section>

        {statement.invalidTransactionIds.length >
          0 && (
          <div className="report-section mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {statement.invalidTransactionIds.length}{" "}
            transaction(s) with invalid dates were omitted from this statement.
          </div>
        )}

        <section className="report-table-wrap mt-5 overflow-x-auto">
          <table className="report-table w-full border-collapse text-left text-xs">
            <caption className="sr-only">
              Ledger transactions for {party.name}
            </caption>

            <thead>
              <tr className="border-y border-slate-300 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
                <th
                  scope="col"
                  className="px-2.5 py-2.5 font-semibold"
                >
                  Date
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

                {preferences.showRunningBalance && (
                  <th
                    scope="col"
                    className="px-2.5 py-2.5 text-right font-semibold"
                  >
                    Balance
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {statement.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="border-b border-slate-200 px-3 py-10 text-center text-sm text-slate-500"
                  >
                    No transactions have been recorded for this party.
                  </td>
                </tr>
              ) : (
                statement.rows.map(
                  (row) => (
                    <tr
                      key={row.transaction.id}
                      className="report-row border-b border-slate-200 align-top"
                    >
                      <td className="whitespace-nowrap px-2.5 py-3 text-slate-600">
                        {formatReportTransactionDate(
                          row.transaction.transactionDate,
                        )}
                      </td>

                      <td className="min-w-36 px-2.5 py-3 font-medium text-slate-800">
                        {row.transaction.description}
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

                      {preferences.showRunningBalance && (
                        <td
                          className={`whitespace-nowrap px-2.5 py-3 text-right font-semibold ${balanceTone(
                            row.runningBalance,
                          )}`}
                        >
                          {formatBalanceLabel(
                            row.runningBalance,
                          )}
                        </td>
                      )}
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </section>

        <section className="report-section mt-6 ml-auto max-w-md">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-8 border-b border-slate-200 pb-2">
              <dt className="text-slate-500">
                Opening Balance
              </dt>
              <dd className="font-medium text-slate-800">
                {formatBalanceLabel(
                  statement.openingBalance,
                )}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-8">
              <dt className="text-slate-500">
                Total Credit
              </dt>
              <dd className="font-semibold text-emerald-700">
                {formatCurrency(
                  statement.totalCredit,
                )}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-8">
              <dt className="text-slate-500">
                Total Debit
              </dt>
              <dd className="font-semibold text-rose-700">
                {formatCurrency(
                  statement.totalDebit,
                )}
              </dd>
            </div>

            <div className="mt-3 flex items-center justify-between gap-8 rounded-lg border-2 border-slate-900 bg-slate-50 px-4 py-3">
              <dt className="font-bold text-slate-950">
                Overall Balance
              </dt>
              <dd
                className={`text-base font-bold ${balanceTone(
                  statement.closingBalance,
                )}`}
              >
                {formatBalanceLabel(
                  statement.closingBalance,
                )}
              </dd>
            </div>
            <p className="text-right text-[10px] leading-4 text-slate-500">
              Includes every recorded transaction, even when only the latest rows are printed.
            </p>
          </dl>
        </section>

        <footer className="report-section mt-10 border-t border-slate-300 pt-3 text-[10px] leading-5 text-slate-500">
          {footerText && (
            <p className="font-medium text-slate-600">
              {footerText}
            </p>
          )}

          {preferences.showGeneratedDate && (
            <p>
              Generated {formatReportGeneratedDateTime(
                generatedAt,
              )}
            </p>
          )}
        </footer>
      </article>
    </PrintPreview>
  );
}
