import {
  CalendarRange,
  ListFilter,
  SlidersHorizontal,
} from "lucide-react";

import type {
  Party,
  Region,
} from "../../types";

import type {
  DateRangePrintPreferences,
  ReportOrientation,
  StatementPrintPreferences,
} from "../../types/reports";
import {
  MAX_CUSTOM_TRANSACTION_LIMIT,
  PRESET_TRANSACTION_LIMITS,
} from "../../utils/statementLimits";

interface PartyReportFiltersProps {
  parties: readonly Party[];
  regions: readonly Region[];
  selectedPartyId: string;
  preferences: StatementPrintPreferences;
  customTransactionLimit: string;
  usesCustomTransactionLimit: boolean;
  partySelectionInvalid?: boolean;
  transactionLimitInvalid?: boolean;
  validationErrorId?: string;
  onPartyChange: (partyId: string) => void;
  onCustomTransactionLimitChange: (value: string) => void;
  onTransactionLimitChange: (value: string) => void;
  onPreferencesChange: (
    preferences: StatementPrintPreferences,
  ) => void;
}

interface RegionReportFiltersProps {
  regions: readonly Region[];
  selectedRegionId: string;
  fromDate: string;
  toDate: string;
  showPartyBreakdown: boolean;
  orientation: ReportOrientation;
  regionSelectionInvalid?: boolean;
  dateRangeInvalid?: boolean;
  validationErrorId?: string;
  onRegionChange: (regionId: string) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onShowPartyBreakdownChange: (value: boolean) => void;
  onOrientationChange: (value: ReportOrientation) => void;
}

interface DateRangeReportFiltersProps {
  parties: readonly Party[];
  regions: readonly Region[];
  selectedPartyId: string;
  selectedRegionId: string;
  fromDate: string;
  toDate: string;
  preferences: DateRangePrintPreferences;
  dateRangeInvalid?: boolean;
  validationErrorId?: string;
  onPartyChange: (partyId: string) => void;
  onRegionChange: (regionId: string) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onPreferencesChange: (
    preferences: DateRangePrintPreferences,
  ) => void;
}

function CheckboxOption({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
        className="h-4 w-4 rounded border-slate-300 accent-slate-900"
      />

      <span>{label}</span>
    </label>
  );
}

const fieldClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-500";

function getPartyOptionLabel(
  party: Party,
  regions: readonly Region[],
) {
  const regionName =
    regions.find(
      (region) =>
        region.id ===
        party.regionId,
    )?.name ?? "Unknown region";

  const identity =
    party.phone || party.gstin;

  return `${party.name} — ${regionName}${
    identity
      ? ` • ${identity}`
      : ""
  }`;
}

export function PartyReportFilters({
  parties,
  regions,
  selectedPartyId,
  preferences,
  customTransactionLimit,
  usesCustomTransactionLimit,
  partySelectionInvalid = false,
  transactionLimitInvalid = false,
  validationErrorId,
  onPartyChange,
  onCustomTransactionLimitChange,
  onTransactionLimitChange,
  onPreferencesChange,
}: PartyReportFiltersProps) {
  function updatePreferences(
    changes: Partial<StatementPrintPreferences>,
  ) {
    onPreferencesChange({
      ...preferences,
      ...changes,
    });
  }

  const transactionLimitSelectValue =
    usesCustomTransactionLimit
      ? "CUSTOM"
      : preferences.transactionLimit.toString();

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ListFilter size={16} />
          Party statement
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Party
            </span>

            <select
              value={selectedPartyId}
              aria-invalid={
                partySelectionInvalid ||
                undefined
              }
              aria-describedby={
                partySelectionInvalid
                  ? validationErrorId
                  : undefined
              }
              onChange={(event) =>
                onPartyChange(
                  event.target.value,
                )
              }
              className={fieldClassName}
            >
              <option value="">
                Select a party
              </option>

              {parties.map((party) => (
                <option
                  key={party.id}
                  value={party.id}
                >
                  {getPartyOptionLabel(
                    party,
                    regions,
                  )}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            The statement always uses the party's complete ledger history. Its overall balance is never limited by the number of rows printed.
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <SlidersHorizontal size={16} />
          Print options
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Transactions
            </span>

            <select
              value={transactionLimitSelectValue}
              aria-invalid={
                transactionLimitInvalid ||
                undefined
              }
              aria-describedby={
                transactionLimitInvalid
                  ? validationErrorId
                  : undefined
              }
              onChange={(event) => onTransactionLimitChange(event.target.value)}
              className={fieldClassName}
            >
              {PRESET_TRANSACTION_LIMITS.map((limit) => (
                <option key={limit} value={limit}>Last {limit}</option>
              ))}
              <option value="ALL">All transactions</option>
              <option value="CUSTOM">Custom number</option>
            </select>
          </label>

          {transactionLimitSelectValue === "CUSTOM" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">
                Number of transactions
              </span>

              <input
                type="number"
                min={1}
                max={MAX_CUSTOM_TRANSACTION_LIMIT}
                step={1}
                inputMode="numeric"
                value={customTransactionLimit}
                aria-invalid={
                  transactionLimitInvalid ||
                  undefined
                }
                aria-describedby={
                  transactionLimitInvalid
                    ? validationErrorId
                    : undefined
                }
                onChange={(event) =>
                  onCustomTransactionLimitChange(
                    event.target.value,
                  )
                }
                placeholder="Enter 1 to 10,000"
                className={fieldClassName}
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Page orientation
            </span>

            <select
              value={preferences.orientation}
              onChange={(event) =>
                updatePreferences({
                  orientation:
                    event.target.value as ReportOrientation,
                })
              }
              className={fieldClassName}
            >
              <option value="portrait">A4 Portrait</option>
              <option value="landscape">A4 Landscape</option>
            </select>
          </label>

          <div className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Optional columns
            </span>

            <div className="grid gap-2 sm:grid-cols-2">
              <CheckboxOption
                checked={preferences.showRunningBalance}
                label="Running balance"
                onChange={(checked) =>
                  updatePreferences({
                    showRunningBalance:
                      checked,
                  })
                }
              />

              <CheckboxOption
                checked={preferences.showTransactionTime}
                label="Transaction time"
                onChange={(checked) =>
                  updatePreferences({
                    showTransactionTime:
                      checked,
                  })
                }
              />

              <CheckboxOption
                checked={preferences.showNotes}
                label="Notes"
                onChange={(checked) =>
                  updatePreferences({
                    showNotes: checked,
                  })
                }
              />

              <CheckboxOption
                checked={preferences.showAttachment}
                label="Attachment / invoice"
                onChange={(checked) =>
                  updatePreferences({
                    showAttachment:
                      checked,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <details className="border-t border-slate-100 pt-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Header and footer options
        </summary>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CheckboxOption
            checked={preferences.showBusinessAddress}
            label="Business address"
            onChange={(checked) =>
              updatePreferences({
                showBusinessAddress:
                  checked,
              })
            }
          />

          <CheckboxOption
            checked={preferences.showBusinessPhone}
            label="Business phone"
            onChange={(checked) =>
              updatePreferences({
                showBusinessPhone:
                  checked,
              })
            }
          />

          <CheckboxOption
            checked={preferences.showBusinessGstin}
            label="Business GSTIN"
            onChange={(checked) =>
              updatePreferences({
                showBusinessGstin:
                  checked,
              })
            }
          />

          <CheckboxOption
            checked={preferences.showGeneratedDate}
            label="Generated date"
            onChange={(checked) =>
              updatePreferences({
                showGeneratedDate:
                  checked,
              })
            }
          />

          <label className="block sm:col-span-2 xl:col-span-4">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Custom footer text
            </span>

            <input
              value={preferences.customFooter}
              onChange={(event) =>
                updatePreferences({
                  customFooter:
                    event.target.value,
                })
              }
              placeholder="Optional message shown at the bottom of the statement"
              className={fieldClassName}
            />
          </label>
        </div>
      </details>
    </div>
  );
}

export function RegionReportFilters({
  regions,
  selectedRegionId,
  fromDate,
  toDate,
  showPartyBreakdown,
  orientation,
  regionSelectionInvalid = false,
  dateRangeInvalid = false,
  validationErrorId,
  onRegionChange,
  onFromDateChange,
  onToDateChange,
  onShowPartyBreakdownChange,
  onOrientationChange,
}: RegionReportFiltersProps) {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarRange size={16} />
          Report range
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block xl:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Region
            </span>

            <select
              value={selectedRegionId}
              aria-invalid={
                regionSelectionInvalid ||
                undefined
              }
              aria-describedby={
                regionSelectionInvalid
                  ? validationErrorId
                  : undefined
              }
              onChange={(event) =>
                onRegionChange(
                  event.target.value,
                )
              }
              className={fieldClassName}
            >
              <option value="ALL">All regions</option>

              {regions.map((region) => (
                <option
                  key={region.id}
                  value={region.id}
                >
                  {region.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              From date
            </span>

            <input
              type="date"
              value={fromDate}
              aria-invalid={
                dateRangeInvalid ||
                undefined
              }
              aria-describedby={
                dateRangeInvalid
                  ? validationErrorId
                  : undefined
              }
              onChange={(event) =>
                onFromDateChange(
                  event.target.value,
                )
              }
              className={fieldClassName}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              To date
            </span>

            <input
              type="date"
              value={toDate}
              aria-invalid={
                dateRangeInvalid ||
                undefined
              }
              aria-describedby={
                dateRangeInvalid
                  ? validationErrorId
                  : undefined
              }
              onChange={(event) =>
                onToDateChange(
                  event.target.value,
                )
              }
              className={fieldClassName}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <CheckboxOption
          checked={showPartyBreakdown}
          label="Show party breakdown"
          onChange={onShowPartyBreakdownChange}
        />

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">
            Page orientation
          </span>

          <select
            value={orientation}
            onChange={(event) =>
              onOrientationChange(
                event.target.value as ReportOrientation,
              )
            }
            className={fieldClassName}
          >
            <option value="portrait">A4 Portrait</option>
            <option value="landscape">A4 Landscape</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export function DateRangeReportFilters({
  parties,
  regions,
  selectedPartyId,
  selectedRegionId,
  fromDate,
  toDate,
  preferences,
  dateRangeInvalid = false,
  validationErrorId,
  onPartyChange,
  onRegionChange,
  onFromDateChange,
  onToDateChange,
  onPreferencesChange,
}: DateRangeReportFiltersProps) {
  function updatePreferences(
    changes: Partial<DateRangePrintPreferences>,
  ) {
    onPreferencesChange({
      ...preferences,
      ...changes,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarRange size={16} />
          Transaction range
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Region
            </span>

            <select
              value={selectedRegionId}
              onChange={(event) =>
                onRegionChange(
                  event.target.value,
                )
              }
              className={fieldClassName}
            >
              <option value="ALL">All regions</option>

              {regions.map((region) => (
                <option
                  key={region.id}
                  value={region.id}
                >
                  {region.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Party
            </span>

            <select
              value={selectedPartyId}
              onChange={(event) =>
                onPartyChange(
                  event.target.value,
                )
              }
              className={fieldClassName}
            >
              <option value="ALL">All parties</option>

              {parties.map((party) => (
                <option
                  key={party.id}
                  value={party.id}
                >
                  {getPartyOptionLabel(
                    party,
                    regions,
                  )}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              From date
            </span>

            <input
              type="date"
              value={fromDate}
              aria-invalid={
                dateRangeInvalid ||
                undefined
              }
              aria-describedby={
                dateRangeInvalid
                  ? validationErrorId
                  : undefined
              }
              onChange={(event) =>
                onFromDateChange(
                  event.target.value,
                )
              }
              className={fieldClassName}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              To date
            </span>

            <input
              type="date"
              value={toDate}
              aria-invalid={
                dateRangeInvalid ||
                undefined
              }
              aria-describedby={
                dateRangeInvalid
                  ? validationErrorId
                  : undefined
              }
              onChange={(event) =>
                onToDateChange(
                  event.target.value,
                )
              }
              className={fieldClassName}
            />
          </label>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <SlidersHorizontal size={16} />
          Print options
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CheckboxOption
            checked={preferences.showTransactionTime}
            label="Transaction time"
            onChange={(checked) =>
              updatePreferences({
                showTransactionTime:
                  checked,
              })
            }
          />

          <CheckboxOption
            checked={preferences.showNotes}
            label="Notes"
            onChange={(checked) =>
              updatePreferences({
                showNotes: checked,
              })
            }
          />

          <CheckboxOption
            checked={preferences.showAttachment}
            label="Attachment / invoice"
            onChange={(checked) =>
              updatePreferences({
                showAttachment:
                  checked,
              })
            }
          />

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">
              Page orientation
            </span>

            <select
              value={preferences.orientation}
              onChange={(event) =>
                updatePreferences({
                  orientation:
                    event.target.value as ReportOrientation,
                })
              }
              className={fieldClassName}
            >
              <option value="portrait">A4 Portrait</option>
              <option value="landscape">A4 Landscape</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
