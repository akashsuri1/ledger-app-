import { useState } from "react";

import type { FormEvent } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

import { useLedger } from "../../hooks/useLedger";
import type { Company, NewCompany, UpdateCompany } from "../../types";
import Modal from "../ui/Modal";

interface CompanyFormModalProps {
  open: boolean;
  company?: Company;
  onClose: () => void;
  onSaved?: (company: Company, mode: "create" | "edit") => void;
}

function cleanCompanyName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export default function CompanyFormModal({
  open,
  company,
  onClose,
  onSaved,
}: CompanyFormModalProps) {
  const { createCompany, updateCompany } = useLedger();
  const [name, setName] = useState(company?.name ?? "");
  const [address, setAddress] = useState(company?.address ?? "");
  const [phone, setPhone] = useState(company?.phone ?? "");
  const [gstin, setGstin] = useState(company?.gstin ?? "");
  const [email, setEmail] = useState(company?.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(company);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = cleanCompanyName(name);
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      toast.error("Company name is required.");
      return;
    }

    if (cleanPhone && !/^\d{10}$/.test(cleanPhone)) {
      toast.error("Phone number must contain exactly 10 digits.");
      return;
    }

    if (
      cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      toast.error("Enter a valid email address.");
      return;
    }

    const input: NewCompany = {
      name: cleanName,
      address: address.trim(),
      phone: cleanPhone,
      gstin: gstin.trim().toUpperCase(),
      email: cleanEmail,
    };

    setSubmitting(true);

    try {
      if (company) {
        const update: UpdateCompany = { ...input };
        updateCompany(company.id, update);

        const updatedCompany: Company = {
          ...company,
          ...input,
        };

        toast.success("Company updated", {
          description: `${cleanName}'s details have been saved.`,
        });
        onSaved?.(updatedCompany, "edit");
      } else {
        const createdCompany = createCompany(input);
        toast.success("Company created", {
          description: `${createdCompany.name} is now the active company.`,
        });
        onSaved?.(createdCompany, "create");
      }

      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save the company.",
      );
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit company" : "Add company"}
      description={
        isEditing
          ? "Update this company's identity and contact details."
          : "Create a separate, empty workspace. Financial records are never copied from another company."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="company-name" className="text-sm font-medium text-slate-700">
            Company name *
          </label>
          <input
            id="company-name"
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Example: ABC Enterprises"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            Company names must be unique in LedgerFlow.
          </p>
        </div>

        <div>
          <label htmlFor="company-address" className="text-sm font-medium text-slate-700">
            Business address
          </label>
          <textarea
            id="company-address"
            rows={3}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Street, city, state, postal code"
            className={`${inputClass} resize-y`}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="company-phone" className="text-sm font-medium text-slate-700">
              Phone
            </label>
            <input
              id="company-phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="10-digit number"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="company-email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="company-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="accounts@example.com"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="company-gstin" className="text-sm font-medium text-slate-700">
            GSTIN
          </label>
          <input
            id="company-gstin"
            value={gstin}
            onChange={(event) => setGstin(event.target.value.toUpperCase())}
            placeholder="Business GST identification number"
            className={`${inputClass} uppercase`}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Building2 size={17} aria-hidden="true" />
            {submitting
              ? "Saving..."
              : isEditing
                ? "Save company"
                : "Create company"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
