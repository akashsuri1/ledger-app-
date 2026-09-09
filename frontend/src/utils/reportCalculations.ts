import type {
  LedgerTransaction,
  Party,
  Region,
} from "../types";

import {
  roundCurrency,
} from "./currency";

export type ReportDateBoundary =
  | "start"
  | "end";

export interface ReportDateRangeInput {
  from?: string;
  to?: string;
}

export type ReportValidationCode =
  | "INVALID_FROM_DATE"
  | "INVALID_TO_DATE"
  | "INVALID_DATE_RANGE"
  | "INVALID_LAST_N";

export interface ReportValidationIssue {
  code: ReportValidationCode;
  message: string;
}

export interface ValidatedReportDateRange {
  from?: string;
  to?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  isValid: boolean;
  issues: ReportValidationIssue[];
}

export interface PartyStatementInput
  extends ReportDateRangeInput {
  partyId: number;
  transactions: readonly LedgerTransaction[];
  /** Omit this value to display every transaction in the date window. */
  lastN?: number;
}

export interface PartyStatementRow {
  transaction: LedgerTransaction;
  credit: number;
  debit: number;
  signedAmount: number;
  runningBalance: number;
}

export interface PartyStatementResult {
  partyId: number;
  dateRange: ValidatedReportDateRange;
  requestedLastN?: number;
  eligibleTransactionCount: number;
  displayedTransactionCount: number;
  openingBalance: number;
  totalCredit: number;
  totalDebit: number;
  netMovement: number;
  closingBalance: number;
  rows: PartyStatementRow[];
  invalidTransactionIds: number[];
  isValid: boolean;
  validationIssues: ReportValidationIssue[];
}

export interface DateRangeReportInput
  extends ReportDateRangeInput {
  transactions: readonly LedgerTransaction[];
  /**
   * Omit this value to include every party. An explicitly empty array
   * intentionally produces an empty report.
   */
  partyIds?: readonly number[];
}

export interface DateRangeReportRow {
  transaction: LedgerTransaction;
  credit: number;
  debit: number;
  signedAmount: number;
}

export interface DateRangeReportResult {
  dateRange: ValidatedReportDateRange;
  rows: DateRangeReportRow[];
  transactionCount: number;
  totalCredit: number;
  totalDebit: number;
  netMovement: number;
  invalidTransactionIds: number[];
  isValid: boolean;
  validationIssues: ReportValidationIssue[];
}

export interface RegionReportInput
  extends ReportDateRangeInput {
  regions: readonly Region[];
  parties: readonly Party[];
  transactions: readonly LedgerTransaction[];
  /** Omit this value to include every supplied region. */
  regionId?: number;
}

export interface RegionPartyBreakdown {
  party: Party;
  transactionCount: number;
  totalCredit: number;
  totalDebit: number;
  openingBalance: number;
  /** Credit minus debit for transactions inside the selected date window. */
  netMovement: number;
  closingBalance: number;
  /** Alias of closingBalance retained for report consumers. */
  balance: number;
  receivable: number;
  payable: number;
}

export interface RegionReportRow {
  region: Region;
  partyCount: number;
  transactionCount: number;
  totalCredit: number;
  totalDebit: number;
  openingBalance: number;
  netMovement: number;
  closingBalance: number;
  netBalance: number;
  totalReceivable: number;
  totalPayable: number;
  parties: RegionPartyBreakdown[];
}

export interface RegionReportTotals {
  regionCount: number;
  partyCount: number;
  transactionCount: number;
  totalCredit: number;
  totalDebit: number;
  openingBalance: number;
  netMovement: number;
  closingBalance: number;
  netBalance: number;
  totalReceivable: number;
  totalPayable: number;
}

export interface RegionReportResult {
  regionId?: number;
  dateRange: ValidatedReportDateRange;
  rows: RegionReportRow[];
  totals: RegionReportTotals;
  invalidTransactionIds: number[];
  isValid: boolean;
  validationIssues: ReportValidationIssue[];
}

interface DatedTransaction {
  transaction: LedgerTransaction;
  timestamp: number;
  sourceIndex: number;
}

const DATE_ONLY_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})$/;

const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

const ZONED_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/i;

function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const date = new Date(0);
  date.setUTCFullYear(
    year,
    month - 1,
    day,
  );
  date.setUTCHours(0, 0, 0, 0);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidClockTime(
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
) {
  return (
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23 &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 59 &&
    Number.isInteger(second) &&
    second >= 0 &&
    second <= 59 &&
    Number.isInteger(millisecond) &&
    millisecond >= 0 &&
    millisecond <= 999
  );
}

function parseMilliseconds(
  value: string | undefined,
) {
  if (!value) {
    return 0;
  }

  return Number(
    value.padEnd(3, "0"),
  );
}

/**
 * Parses LedgerFlow's ISO-like local date values without letting date-only
 * strings shift days because of UTC conversion. A date-only `end` boundary
 * represents the final millisecond of that local calendar day.
 */
export function parseReportDate(
  value: string,
  boundary: ReportDateBoundary =
    "start",
): number | null {
  const normalized =
    value.trim();

  if (!normalized) {
    return null;
  }

  const dateOnlyMatch =
    DATE_ONLY_PATTERN.exec(
      normalized,
    );

  if (dateOnlyMatch) {
    const year = Number(
      dateOnlyMatch[1],
    );
    const month = Number(
      dateOnlyMatch[2],
    );
    const day = Number(
      dateOnlyMatch[3],
    );

    if (
      !isValidCalendarDate(
        year,
        month,
        day,
      )
    ) {
      return null;
    }

    const date = new Date(0);
    date.setFullYear(
      year,
      month - 1,
      day,
    );
    date.setHours(
      boundary === "end"
        ? 23
        : 0,
      boundary === "end"
        ? 59
        : 0,
      boundary === "end"
        ? 59
        : 0,
      boundary === "end"
        ? 999
        : 0,
    );

    return date.getTime();
  }

  const localDateTimeMatch =
    LOCAL_DATE_TIME_PATTERN.exec(
      normalized,
    );

  if (localDateTimeMatch) {
    const year = Number(
      localDateTimeMatch[1],
    );
    const month = Number(
      localDateTimeMatch[2],
    );
    const day = Number(
      localDateTimeMatch[3],
    );
    const hour = Number(
      localDateTimeMatch[4],
    );
    const minute = Number(
      localDateTimeMatch[5],
    );
    const second = Number(
      localDateTimeMatch[6] ??
        "0",
    );
    const millisecond =
      parseMilliseconds(
        localDateTimeMatch[7],
      );

    if (
      !isValidCalendarDate(
        year,
        month,
        day,
      ) ||
      !isValidClockTime(
        hour,
        minute,
        second,
        millisecond,
      )
    ) {
      return null;
    }

    const date = new Date(0);
    date.setFullYear(
      year,
      month - 1,
      day,
    );
    date.setHours(
      hour,
      minute,
      second,
      millisecond,
    );

    if (
      date.getFullYear() !== year ||
      date.getMonth() !==
        month - 1 ||
      date.getDate() !== day ||
      date.getHours() !== hour ||
      date.getMinutes() !==
        minute ||
      date.getSeconds() !==
        second ||
      date.getMilliseconds() !==
        millisecond
    ) {
      return null;
    }

    return date.getTime();
  }

  const zonedDateTimeMatch =
    ZONED_DATE_TIME_PATTERN.exec(
      normalized,
    );

  if (!zonedDateTimeMatch) {
    return null;
  }

  const year = Number(
    zonedDateTimeMatch[1],
  );
  const month = Number(
    zonedDateTimeMatch[2],
  );
  const day = Number(
    zonedDateTimeMatch[3],
  );
  const hour = Number(
    zonedDateTimeMatch[4],
  );
  const minute = Number(
    zonedDateTimeMatch[5],
  );
  const second = Number(
    zonedDateTimeMatch[6] ??
      "0",
  );
  const millisecond =
    parseMilliseconds(
      zonedDateTimeMatch[7],
    );
  const zone =
    zonedDateTimeMatch[8];

  if (
    !isValidCalendarDate(
      year,
      month,
      day,
    ) ||
    !isValidClockTime(
      hour,
      minute,
      second,
      millisecond,
    ) ||
    (
      zone.toUpperCase() !==
        "Z" &&
      Number(
        zone.slice(-2),
      ) > 59
    )
  ) {
    return null;
  }

  const timestamp =
    Date.parse(normalized);

  return Number.isFinite(
    timestamp,
  )
    ? timestamp
    : null;
}

export function validateReportDateRange(
  input: ReportDateRangeInput,
): ValidatedReportDateRange {
  const from =
    input.from?.trim() ||
    undefined;
  const to =
    input.to?.trim() ||
    undefined;
  const fromTimestamp = from
    ? parseReportDate(
        from,
        "start",
      )
    : undefined;
  const toTimestamp = to
    ? parseReportDate(
        to,
        "end",
      )
    : undefined;
  const issues: ReportValidationIssue[] =
    [];

  if (
    from &&
    fromTimestamp === null
  ) {
    issues.push({
      code: "INVALID_FROM_DATE",
      message:
        "The report start date is invalid.",
    });
  }

  if (
    to &&
    toTimestamp === null
  ) {
    issues.push({
      code: "INVALID_TO_DATE",
      message:
        "The report end date is invalid.",
    });
  }

  if (
    typeof fromTimestamp ===
      "number" &&
    typeof toTimestamp ===
      "number" &&
    fromTimestamp > toTimestamp
  ) {
    issues.push({
      code: "INVALID_DATE_RANGE",
      message:
        "The report start date must not be after the end date.",
    });
  }

  return {
    from,
    to,
    fromTimestamp:
      typeof fromTimestamp ===
      "number"
        ? fromTimestamp
        : undefined,
    toTimestamp:
      typeof toTimestamp ===
      "number"
        ? toTimestamp
        : undefined,
    isValid:
      issues.length === 0,
    issues,
  };
}

function toCurrency(
  amount: number,
) {
  const rounded =
    roundCurrency(amount);

  return Object.is(
    rounded,
    -0,
  )
    ? 0
    : rounded;
}

function addCurrency(
  left: number,
  right: number,
) {
  return toCurrency(
    toCurrency(left) +
      toCurrency(right),
  );
}

function subtractCurrency(
  left: number,
  right: number,
) {
  return addCurrency(
    left,
    -toCurrency(right),
  );
}

export function getSignedTransactionAmount(
  transaction: LedgerTransaction,
) {
  const amount =
    toCurrency(
      transaction.amount,
    );

  return transaction.type ===
    "CREDIT"
    ? amount
    : toCurrency(-amount);
}

function isInsideDateRange(
  timestamp: number,
  range: ValidatedReportDateRange,
) {
  return (
    (
      range.fromTimestamp ===
        undefined ||
      timestamp >=
        range.fromTimestamp
    ) &&
    (
      range.toTimestamp ===
        undefined ||
      timestamp <=
        range.toTimestamp
    )
  );
}

function compareDatedTransactions(
  left: DatedTransaction,
  right: DatedTransaction,
) {
  if (
    left.timestamp !==
    right.timestamp
  ) {
    return (
      left.timestamp -
      right.timestamp
    );
  }

  if (
    left.transaction.id !==
    right.transaction.id
  ) {
    return (
      left.transaction.id -
      right.transaction.id
    );
  }

  return (
    left.sourceIndex -
    right.sourceIndex
  );
}

function collectDatedTransactions(
  transactions: readonly LedgerTransaction[],
  include: (
    transaction: LedgerTransaction,
  ) => boolean,
) {
  const datedTransactions: DatedTransaction[] =
    [];
  const invalidTransactionIds: number[] =
    [];

  transactions.forEach(
    (
      transaction,
      sourceIndex,
    ) => {
      if (!include(transaction)) {
        return;
      }

      const timestamp =
        parseReportDate(
          transaction.transactionDate,
        );

      if (timestamp === null) {
        invalidTransactionIds.push(
          transaction.id,
        );
        return;
      }

      datedTransactions.push({
        transaction,
        timestamp,
        sourceIndex,
      });
    },
  );

  datedTransactions.sort(
    compareDatedTransactions,
  );
  invalidTransactionIds.sort(
    (left, right) =>
      left - right,
  );

  return {
    datedTransactions,
    invalidTransactionIds,
  };
}

function sumSignedTransactions(
  transactions: readonly DatedTransaction[],
) {
  return transactions.reduce(
    (total, item) =>
      addCurrency(
        total,
        getSignedTransactionAmount(
          item.transaction,
        ),
      ),
    0,
  );
}

function emptyPartyStatement(
  input: PartyStatementInput,
  dateRange: ValidatedReportDateRange,
  invalidTransactionIds: number[],
  validationIssues: ReportValidationIssue[],
): PartyStatementResult {
  return {
    partyId: input.partyId,
    dateRange,
    requestedLastN:
      input.lastN,
    eligibleTransactionCount: 0,
    displayedTransactionCount: 0,
    openingBalance: 0,
    totalCredit: 0,
    totalDebit: 0,
    netMovement: 0,
    closingBalance: 0,
    rows: [],
    invalidTransactionIds,
    isValid: false,
    validationIssues,
  };
}

export function calculatePartyStatement(
  input: PartyStatementInput,
): PartyStatementResult {
  const dateRange =
    validateReportDateRange(
      input,
    );
  const {
    datedTransactions,
    invalidTransactionIds,
  } = collectDatedTransactions(
    input.transactions,
    (transaction) =>
      transaction.partyId ===
      input.partyId,
  );
  const validationIssues = [
    ...dateRange.issues,
  ];

  if (
    input.lastN !==
      undefined &&
    (
      !Number.isSafeInteger(
        input.lastN,
      ) ||
      input.lastN <= 0
    )
  ) {
    validationIssues.push({
      code: "INVALID_LAST_N",
      message:
        "Last N must be a positive whole number.",
    });
  }

  if (
    validationIssues.length > 0
  ) {
    return emptyPartyStatement(
      input,
      dateRange,
      invalidTransactionIds,
      validationIssues,
    );
  }

  const eligibleTransactions =
    datedTransactions.filter(
      (item) =>
        isInsideDateRange(
          item.timestamp,
          dateRange,
        ),
    );
  const displayedTransactions =
    input.lastN === undefined
      ? eligibleTransactions
      : eligibleTransactions.slice(
          -input.lastN,
        );

  let openingBalance = 0;

  if (
    displayedTransactions.length >
    0
  ) {
    const firstDisplayed =
      displayedTransactions[0];
    const firstDisplayedIndex =
      datedTransactions.indexOf(
        firstDisplayed,
      );

    openingBalance =
      sumSignedTransactions(
        datedTransactions.slice(
          0,
          firstDisplayedIndex,
        ),
      );
  } else if (
    dateRange.fromTimestamp !==
    undefined
  ) {
    const openingCutoff =
      dateRange.fromTimestamp;

    openingBalance =
      sumSignedTransactions(
        datedTransactions.filter(
          (item) =>
            item.timestamp <
            openingCutoff,
        ),
      );
  }

  let runningBalance =
    openingBalance;
  let totalCredit = 0;
  let totalDebit = 0;

  const rows =
    displayedTransactions.map(
      (item): PartyStatementRow => {
        const isCredit =
          item.transaction.type ===
          "CREDIT";
        const credit = isCredit
          ? toCurrency(
              item.transaction.amount,
            )
          : 0;
        const debit = isCredit
          ? 0
          : toCurrency(
              item.transaction.amount,
            );
        const signedAmount =
          getSignedTransactionAmount(
            item.transaction,
          );

        totalCredit =
          addCurrency(
            totalCredit,
            credit,
          );
        totalDebit =
          addCurrency(
            totalDebit,
            debit,
          );
        runningBalance =
          addCurrency(
            runningBalance,
            signedAmount,
          );

        return {
          transaction:
            item.transaction,
          credit,
          debit,
          signedAmount,
          runningBalance,
        };
      },
    );
  const netMovement =
    subtractCurrency(
      totalCredit,
      totalDebit,
    );
  const closingBalance =
    addCurrency(
      openingBalance,
      netMovement,
    );

  return {
    partyId: input.partyId,
    dateRange,
    requestedLastN:
      input.lastN,
    eligibleTransactionCount:
      eligibleTransactions.length,
    displayedTransactionCount:
      rows.length,
    openingBalance,
    totalCredit,
    totalDebit,
    netMovement,
    closingBalance,
    rows,
    invalidTransactionIds,
    isValid: true,
    validationIssues: [],
  };
}

export function calculateDateRangeReport(
  input: DateRangeReportInput,
): DateRangeReportResult {
  const dateRange =
    validateReportDateRange(
      input,
    );
  const selectedPartyIds =
    input.partyIds === undefined
      ? undefined
      : new Set(input.partyIds);
  const {
    datedTransactions,
    invalidTransactionIds,
  } = collectDatedTransactions(
    input.transactions,
    (transaction) =>
      selectedPartyIds ===
        undefined ||
      selectedPartyIds.has(
        transaction.partyId,
      ),
  );

  if (!dateRange.isValid) {
    return {
      dateRange,
      rows: [],
      transactionCount: 0,
      totalCredit: 0,
      totalDebit: 0,
      netMovement: 0,
      invalidTransactionIds,
      isValid: false,
      validationIssues: [
        ...dateRange.issues,
      ],
    };
  }

  let totalCredit = 0;
  let totalDebit = 0;
  const rows = datedTransactions
    .filter((item) =>
      isInsideDateRange(
        item.timestamp,
        dateRange,
      ),
    )
    .map(
      (item): DateRangeReportRow => {
        const isCredit =
          item.transaction.type ===
          "CREDIT";
        const credit = isCredit
          ? toCurrency(
              item.transaction.amount,
            )
          : 0;
        const debit = isCredit
          ? 0
          : toCurrency(
              item.transaction.amount,
            );

        totalCredit = addCurrency(
          totalCredit,
          credit,
        );
        totalDebit = addCurrency(
          totalDebit,
          debit,
        );

        return {
          transaction:
            item.transaction,
          credit,
          debit,
          signedAmount:
            getSignedTransactionAmount(
              item.transaction,
            ),
        };
      },
    );

  return {
    dateRange,
    rows,
    transactionCount:
      rows.length,
    totalCredit,
    totalDebit,
    netMovement:
      subtractCurrency(
        totalCredit,
        totalDebit,
      ),
    invalidTransactionIds,
    isValid: true,
    validationIssues: [],
  };
}

function groupTransactionsByParty(
  transactions: readonly DatedTransaction[],
) {
  const transactionsByParty =
    new Map<
      number,
      DatedTransaction[]
    >();

  transactions.forEach((item) => {
    const partyTransactions =
      transactionsByParty.get(
        item.transaction.partyId,
      );

    if (partyTransactions) {
      partyTransactions.push(item);
    } else {
      transactionsByParty.set(
        item.transaction.partyId,
        [item],
      );
    }
  });

  return transactionsByParty;
}

function getPartyPeriodBreakdown(
  party: Party,
  allTransactions: readonly DatedTransaction[],
  periodTransactions: readonly DatedTransaction[],
  dateRange: ValidatedReportDateRange,
): RegionPartyBreakdown {
  const openingBalance =
    dateRange.fromTimestamp ===
    undefined
      ? 0
      : sumSignedTransactions(
          allTransactions.filter(
            (item) =>
              item.timestamp <
              dateRange.fromTimestamp!,
          ),
        );
  let totalCredit = 0;
  let totalDebit = 0;

  periodTransactions.forEach(
    (item) => {
      const amount = toCurrency(
        item.transaction.amount,
      );

      if (
        item.transaction.type ===
        "CREDIT"
      ) {
        totalCredit = addCurrency(
          totalCredit,
          amount,
        );
      } else {
        totalDebit = addCurrency(
          totalDebit,
          amount,
        );
      }
    },
  );

  const netMovement =
    subtractCurrency(
      totalCredit,
      totalDebit,
    );
  const closingBalance =
    addCurrency(
      openingBalance,
      netMovement,
    );

  return {
    party,
    transactionCount:
      periodTransactions.length,
    totalCredit,
    totalDebit,
    openingBalance,
    netMovement,
    closingBalance,
    balance: closingBalance,
    receivable:
      closingBalance > 0
        ? closingBalance
        : 0,
    payable:
      closingBalance < 0
        ? toCurrency(
            Math.abs(
              closingBalance,
            ),
          )
        : 0,
  };
}

function emptyRegionTotals(): RegionReportTotals {
  return {
    regionCount: 0,
    partyCount: 0,
    transactionCount: 0,
    totalCredit: 0,
    totalDebit: 0,
    openingBalance: 0,
    netMovement: 0,
    closingBalance: 0,
    netBalance: 0,
    totalReceivable: 0,
    totalPayable: 0,
  };
}

export function calculateRegionReport(
  input: RegionReportInput,
): RegionReportResult {
  const dateRange =
    validateReportDateRange(
      input,
    );
  const selectedRegions =
    input.regions.filter(
      (region) =>
        input.regionId ===
          undefined ||
        region.id ===
          input.regionId,
    );
  const selectedRegionIds =
    new Set(
      selectedRegions.map(
        (region) =>
          region.id,
      ),
    );
  const selectedParties =
    input.parties.filter(
      (party) =>
        selectedRegionIds.has(
          party.regionId,
        ),
    );
  const selectedPartyIds =
    new Set(
      selectedParties.map(
        (party) => party.id,
      ),
    );
  const {
    datedTransactions,
    invalidTransactionIds,
  } = collectDatedTransactions(
    input.transactions,
    (transaction) =>
      selectedPartyIds.has(
        transaction.partyId,
      ),
  );

  if (!dateRange.isValid) {
    return {
      regionId: input.regionId,
      dateRange,
      rows: [],
      totals:
        emptyRegionTotals(),
      invalidTransactionIds,
      isValid: false,
      validationIssues: [
        ...dateRange.issues,
      ],
    };
  }

  const periodTransactions =
    datedTransactions.filter(
      (item) =>
        isInsideDateRange(
          item.timestamp,
          dateRange,
        ),
    );
  const allTransactionsByParty =
    groupTransactionsByParty(
      datedTransactions,
    );
  const periodTransactionsByParty =
    groupTransactionsByParty(
      periodTransactions,
    );

  const rows = selectedRegions.map(
    (region): RegionReportRow => {
      const regionParties =
        selectedParties
          .filter(
            (party) =>
              party.regionId ===
              region.id,
          )
          .sort(
            (left, right) =>
              left.name.localeCompare(
                right.name,
                "en-IN",
              ) ||
              left.id - right.id,
          );
      const partyBreakdown =
        regionParties.map((party) =>
          getPartyPeriodBreakdown(
            party,
            allTransactionsByParty.get(
              party.id,
            ) ?? [],
            periodTransactionsByParty.get(
              party.id,
            ) ?? [],
            dateRange,
          ),
        );
      const partyTotals =
        partyBreakdown.reduce(
          (result, party) => ({
            transactionCount:
              result.transactionCount +
              party.transactionCount,
            totalCredit: addCurrency(
              result.totalCredit,
              party.totalCredit,
            ),
            totalDebit: addCurrency(
              result.totalDebit,
              party.totalDebit,
            ),
            openingBalance:
              addCurrency(
                result.openingBalance,
                party.openingBalance,
              ),
            netMovement: addCurrency(
              result.netMovement,
              party.netMovement,
            ),
            closingBalance:
              addCurrency(
                result.closingBalance,
                party.closingBalance,
              ),
            totalReceivable:
              addCurrency(
                result.totalReceivable,
                party.receivable,
              ),
            totalPayable: addCurrency(
              result.totalPayable,
              party.payable,
            ),
          }),
          {
            transactionCount: 0,
            totalCredit: 0,
            totalDebit: 0,
            openingBalance: 0,
            netMovement: 0,
            closingBalance: 0,
            totalReceivable: 0,
            totalPayable: 0,
          },
        );

      return {
        region,
        partyCount:
          partyBreakdown.length,
        ...partyTotals,
        netBalance:
          partyTotals.closingBalance,
        parties: partyBreakdown,
      };
    },
  );
  const totals = rows.reduce(
    (result, row) => ({
      regionCount:
        result.regionCount + 1,
      partyCount:
        result.partyCount +
        row.partyCount,
      transactionCount:
        result.transactionCount +
        row.transactionCount,
      totalCredit: addCurrency(
        result.totalCredit,
        row.totalCredit,
      ),
      totalDebit: addCurrency(
        result.totalDebit,
        row.totalDebit,
      ),
      openingBalance: addCurrency(
        result.openingBalance,
        row.openingBalance,
      ),
      netMovement: addCurrency(
        result.netMovement,
        row.netMovement,
      ),
      closingBalance: addCurrency(
        result.closingBalance,
        row.closingBalance,
      ),
      netBalance: addCurrency(
        result.netBalance,
        row.netBalance,
      ),
      totalReceivable: addCurrency(
        result.totalReceivable,
        row.totalReceivable,
      ),
      totalPayable: addCurrency(
        result.totalPayable,
        row.totalPayable,
      ),
    }),
    emptyRegionTotals(),
  );

  return {
    regionId: input.regionId,
    dateRange,
    rows,
    totals,
    invalidTransactionIds,
    isValid: true,
    validationIssues: [],
  };
}
