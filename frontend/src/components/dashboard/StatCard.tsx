import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  trend?: string;
  tone?: "green" | "red" | "blue" | "neutral";
}

export default function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  tone = "neutral",
}: StatCardProps) {
  const styles = {
    green: {
      icon: "bg-emerald-50 text-emerald-600",
      trend: "text-emerald-600 bg-emerald-50",
    },

    red: {
      icon: "bg-rose-50 text-rose-600",
      trend: "text-rose-600 bg-rose-50",
    },

    blue: {
      icon: "bg-blue-50 text-blue-600",
      trend: "text-blue-600 bg-blue-50",
    },

    neutral: {
      icon: "bg-slate-100 text-slate-700",
      trend: "text-slate-600 bg-slate-100",
    },
  };

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${styles[tone].icon}`}
        >
          <Icon size={21} />
        </div>

        {trend && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[tone].trend}`}
          >
            {trend}
          </span>
        )}
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>

        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          {value}
        </h3>

        <p className="mt-2 text-xs text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}