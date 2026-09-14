import { useState } from "react";
import type { FormEvent } from "react";
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import type {
  Company,
  NewCompany,
} from "../../types";

interface FirstCompanySetupProps {
  onCreate: (company: NewCompany) => Promise<Company>;
}

function cleanCompanyName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export default function FirstCompanySetup({
  onCreate,
}: FirstCompanySetupProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = cleanCompanyName(name);
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError("Company name is required.");
      return;
    }

    if (cleanPhone && !/^\d{10}$/.test(cleanPhone)) {
      setError("Phone number must contain exactly 10 digits.");
      return;
    }

    if (
      cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onCreate({
        name: cleanName,
        gstin: gstin.trim().toUpperCase(),
        phone: cleanPhone,
        email: cleanEmail,
        address: address.trim(),
      });
      navigate("/dashboard", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create the company.",
      );
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
            <Building2 size={22} aria-hidden="true" />
          </span>
          <span className="text-xl font-bold tracking-tight text-slate-950">
            LedgerFlow
          </span>
        </div>

        <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.8fr_1.2fr]">
          <section className="bg-slate-950 p-7 text-white sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              First-time setup
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              Welcome to LedgerFlow
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Create your company to start an isolated ledger workspace. You can add more companies and switch between them later.
            </p>

            <div className="mt-8 space-y-4 text-sm text-slate-300">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 shrink-0 text-emerald-400" size={18} />
                <p>Your ledger is stored securely by the LedgerFlow backend.</p>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={18} />
                <p>Regions, parties, transactions, reports, and settings stay company-specific.</p>
              </div>
            </div>
          </section>

          <section className="p-7 sm:p-10">
            <div>
              <p className="text-sm font-medium text-blue-600">
                Create your company
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Company details
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Only the company name is required. You can complete or change the other details later.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="initial-company-name" className="text-sm font-medium text-slate-700">
                  Company Name *
                </label>
                <input
                  id="initial-company-name"
                  autoFocus
                  required
                  autoComplete="organization"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Example: ABC Enterprises"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="initial-company-gstin" className="text-sm font-medium text-slate-700">
                  GSTIN
                </label>
                <input
                  id="initial-company-gstin"
                  value={gstin}
                  onChange={(event) => setGstin(event.target.value.toUpperCase())}
                  placeholder="Business GST identification number"
                  className={`${inputClass} uppercase`}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="initial-company-phone" className="text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <input
                    id="initial-company-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="10-digit number"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="initial-company-email" className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="initial-company-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="accounts@example.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="initial-company-address" className="text-sm font-medium text-slate-700">
                  Address
                </label>
                <textarea
                  id="initial-company-address"
                  rows={3}
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Street, city, state, postal code"
                  className={`${inputClass} resize-y`}
                />
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Building2 size={17} aria-hidden="true" />
                {submitting ? "Creating company..." : "Create Company"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
