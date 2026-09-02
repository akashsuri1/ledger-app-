import { useMemo } from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useLedger } from "../../context/LedgerContext";
import { formatCurrency } from "../../utils/currency";

interface BalanceChartDataPoint {
  key: string;
  month: string;
  credit: number;
  debit: number;
}

const monthFormatter =
  new Intl.DateTimeFormat(
    "en-IN",
    {
      month: "short",
    },
  );

const compactCurrencyFormatter =
  new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      notation: "compact",
      maximumFractionDigits: 0,
    },
  );

function getMonthKey(
  year: number,
  month: number,
) {
  return `${year}-${String(
    month + 1,
  ).padStart(2, "0")}`;
}

export default function BalanceChart() {
  const { transactions } =
    useLedger();

  const now = new Date();
  const currentYear =
    now.getFullYear();
  const currentMonth =
    now.getMonth();

  const chartData =
    useMemo(() => {
      const data: BalanceChartDataPoint[] =
        [];

      for (
        let offset = 5;
        offset >= 0;
        offset -= 1
      ) {
        const monthDate =
          new Date(
            currentYear,
            currentMonth - offset,
            1,
          );

        data.push({
          key: getMonthKey(
            monthDate.getFullYear(),
            monthDate.getMonth(),
          ),
          month:
            monthFormatter.format(
              monthDate,
            ),
          credit: 0,
          debit: 0,
        });
      }

      const buckets = new Map(
        data.map((item) => [
          item.key,
          item,
        ]),
      );

      transactions.forEach(
        (transaction) => {
          const transactionDate =
            new Date(
              transaction.transactionDateTime,
            );

          if (
            Number.isNaN(
              transactionDate.getTime(),
            ) ||
            !Number.isFinite(
              transaction.amount,
            ) ||
            transaction.amount <= 0
          ) {
            return;
          }

          const bucket =
            buckets.get(
              getMonthKey(
                transactionDate.getFullYear(),
                transactionDate.getMonth(),
              ),
            );

          if (!bucket) {
            return;
          }

          if (
            transaction.type ===
            "CREDIT"
          ) {
            bucket.credit +=
              transaction.amount;
          } else {
            bucket.debit +=
              transaction.amount;
          }
        },
      );

      return data;
    }, [
      currentMonth,
      currentYear,
      transactions,
    ]);

  const hasActivity =
    chartData.some(
      (item) =>
        item.credit > 0 ||
        item.debit > 0,
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-950">
            Balance Overview
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Credit and debit activity
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          Last 6 months
        </div>
      </div>

      <div className="mt-6 h-72">
        {hasActivity ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
            <defs>
              <linearGradient
                id="creditGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="#10b981"
                  stopOpacity={0.2}
                />

                <stop
                  offset="95%"
                  stopColor="#10b981"
                  stopOpacity={0}
                />
              </linearGradient>

              <linearGradient
                id="debitGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="#f43f5e"
                  stopOpacity={0.18}
                />

                <stop
                  offset="95%"
                  stopColor="#f43f5e"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />

            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickFormatter={(value) =>
                compactCurrencyFormatter.format(
                  Number(value),
                )
              }
            />

            <Tooltip
              formatter={(value) =>
                formatCurrency(
                  Number(value),
                )
              }
            />

            <Area
              type="monotone"
              dataKey="credit"
              stroke="#10b981"
              fill="url(#creditGradient)"
              strokeWidth={2}
            />

            <Area
              type="monotone"
              dataKey="debit"
              stroke="#f43f5e"
              fill="url(#debitGradient)"
              strokeWidth={2}
            />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 text-center">
            <p className="text-sm text-slate-500">
              No transaction activity in the last 6 months.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-6 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

          <span className="text-xs text-slate-500">
            Credit
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />

          <span className="text-xs text-slate-500">
            Debit
          </span>
        </div>
      </div>
    </div>
  );
}
