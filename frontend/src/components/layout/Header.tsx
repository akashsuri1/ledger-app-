import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Bell,
  FileText,
  MapPin,
  Plus,
  Search,
  UserRound,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import { toast } from "sonner";

import {
  useLedger,
} from "../../hooks/useLedger";

import {
  useTransactionModal,
} from "../../hooks/useTransactionModal";

import {
  formatCurrency,
} from "../../utils/currency";

import {
  formatTransactionDate,
  compareTransactionsNewestFirst,
} from "../../utils/dateTime";
import { partyApi } from "../../api/partyApi";
import { transactionApi } from "../../api/transactionApi";
import type { LedgerTransaction, Party } from "../../types";

export default function Header() {
  const navigate =
    useNavigate();

  const {
    parties,
    regions,
    transactions,
    getPartyBalance,
    canWrite,
    activeCompanyId,
  } = useLedger();

  const {
    openTransactionModal,
  } =
    useTransactionModal();

  const [query, setQuery] =
    useState("");
  const [searchParties,setSearchParties]=useState<Party[]>([]);
  const [searchTransactions,setSearchTransactions]=useState<LedgerTransaction[]>([]);

  const [
    searchOpen,
    setSearchOpen,
  ] = useState(false);

  const searchRef =
    useRef<HTMLDivElement>(
      null,
    );

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent,
    ) {
      if (
        searchRef.current &&
        !searchRef.current.contains(
          event.target as Node,
        )
      ) {
        setSearchOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  const normalizedQuery =
    query
      .trim()
      .toLowerCase();

  useEffect(()=>{if(!normalizedQuery)return;const controller=new AbortController();const timer=window.setTimeout(()=>{void Promise.all([partyApi.list(activeCompanyId,{search:normalizedQuery,page:1,pageSize:5},controller.signal),transactionApi.list(activeCompanyId,{search:normalizedQuery,page:1,pageSize:5},controller.signal)]).then(([partyPage,transactionPage])=>{setSearchParties(partyPage.data.map(item=>({id:item.id,companyId:item.companyId,regionId:item.regionId,regionName:item.regionName,name:item.name,phone:item.phone,address:item.address,gstin:item.gstin,notes:item.notes,createdAt:item.createdAt,balance:item.balance,transactionCount:item.transactionCount})));setSearchTransactions(transactionPage.data.map(item=>({id:item.id,companyId:item.companyId,partyId:item.partyId,type:item.type,amount:item.amount,transactionDate:item.transactionDate,description:item.description,notes:item.notes,createdAt:item.createdAt,attachmentName:item.attachment?.originalName,attachmentId:item.attachment?.id,attachmentMimeType:item.attachment?.mimeType,attachmentByteSize:item.attachment?.byteSize})))}).catch(()=>undefined)},250);return()=>{window.clearTimeout(timer);controller.abort()}},[activeCompanyId,normalizedQuery]);

  const partyResults =
    useMemo(() => {
      if (!normalizedQuery) {
        return [];
      }

      return (searchParties.length ? searchParties : parties)
        .filter((party) => {
          const region =
            regions.find(
              (item) =>
                item.id ===
                party.regionId,
            );

          return (
            party.name
              .toLowerCase()
              .includes(
                normalizedQuery,
              ) ||
            party.phone
              .toLowerCase()
              .includes(
                normalizedQuery,
              ) ||
            party.gstin
              .toLowerCase()
              .includes(
                normalizedQuery,
              ) ||
            party.address
              .toLowerCase()
              .includes(
                normalizedQuery,
              ) ||
            party.notes
              .toLowerCase()
              .includes(
                normalizedQuery,
              ) ||
            region?.name
              .toLowerCase()
              .includes(
                normalizedQuery,
              )
          );
        })
        .slice(0, 5);
    }, [
      parties,
      searchParties,
      regions,
      normalizedQuery,
    ]);

  const transactionResults =
    useMemo(() => {
      if (!normalizedQuery) {
        return [];
      }

      return (searchTransactions.length ? searchTransactions : transactions)
        .filter(
          (transaction) => {
            const party =
              parties.find(
                (item) =>
                  item.id ===
                  transaction.partyId,
              );

            const region =
              party
                ? regions.find(
                    (item) =>
                      item.id ===
                      party.regionId,
                  )
                : undefined;

            return (
              party?.name
                .toLowerCase()
                .includes(
                  normalizedQuery,
                ) ||
              transaction.description
                .toLowerCase()
                .includes(
                  normalizedQuery,
                ) ||
              transaction.notes
                .toLowerCase()
                .includes(
                  normalizedQuery,
                ) ||
              transaction.attachmentName
                ?.toLowerCase()
                .includes(
                  normalizedQuery,
                ) ||
              region?.name
                .toLowerCase()
                .includes(
                  normalizedQuery,
                )
            );
          },
        )
        .sort(compareTransactionsNewestFirst)
        .slice(0, 5);
    }, [
      transactions,
      searchTransactions,
      parties,
      regions,
      normalizedQuery,
    ]);

  const hasResults =
    partyResults.length >
      0 ||
    transactionResults.length >
      0;

  function closeSearch() {
    setQuery("");
    setSearchOpen(false);
  }

  return (
    <header
      data-app-header
      className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b border-slate-200 bg-white/95 px-6 backdrop-blur lg:px-8"
    >
      {/* GLOBAL SEARCH */}

      <div
        ref={searchRef}
        className="relative min-w-0 flex-1"
      >
        <div className="relative max-w-xl">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={query}
            onFocus={() =>
              setSearchOpen(
                true,
              )
            }
            onChange={(event) => {
              setQuery(
                event.target.value,
              );

              setSearchOpen(
                true,
              );
            }}
            placeholder="Search parties or transactions..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>

        {searchOpen &&
          normalizedQuery && (
            <div className="absolute left-0 top-[52px] z-50 max-h-[520px] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
              {!hasResults && (
                <div className="px-4 py-8 text-center">
                  <Search
                    size={25}
                    className="mx-auto text-slate-300"
                  />

                  <p className="mt-3 text-sm font-medium text-slate-900">
                    No results found
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Try another name, description, note, region or attachment.
                  </p>
                </div>
              )}

              {partyResults.length >
                0 && (
                <div>
                  <p className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Parties
                  </p>

                  {partyResults.map(
                    (party) => {
                      const region =
                        regions.find(
                          (item) =>
                            item.id ===
                            party.regionId,
                        );

                      const balance =
                        getPartyBalance(
                          party.id,
                        );

                      return (
                        <button
                          key={
                            party.id
                          }
                          type="button"
                          onClick={() => {
                            navigate(
                              `/parties/${party.id}`,
                            );

                            closeSearch();
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <UserRound
                              size={18}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {
                                party.name
                              }
                            </p>

                            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                              <MapPin
                                size={11}
                              />

                              {region?.name ??
                                "Unknown region"}
                            </p>
                          </div>

                          <div className="text-right">
                            <p
                              className={`text-xs font-semibold ${
                                balance >
                                0
                                  ? "text-emerald-600"
                                  : balance <
                                      0
                                    ? "text-rose-600"
                                    : "text-slate-500"
                              }`}
                            >
                              {formatCurrency(
                                Math.abs(
                                  balance,
                                ),
                              )}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {balance >
                              0
                                ? "Receivable"
                                : balance <
                                    0
                                  ? "Payable"
                                  : "Settled"}
                            </p>
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}

              {partyResults.length >
                0 &&
                transactionResults.length >
                  0 && (
                  <div className="my-2 border-t border-slate-100" />
                )}

              {transactionResults.length >
                0 && (
                <div>
                  <p className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Transactions
                  </p>

                  {transactionResults.map(
                    (
                      transaction,
                    ) => {
                      const party =
                        parties.find(
                          (item) =>
                            item.id ===
                            transaction.partyId,
                        );

                      const isCredit =
                        transaction.type ===
                        "CREDIT";

                      return (
                        <button
                          key={
                            transaction.id
                          }
                          type="button"
                          onClick={() => {
                            navigate(
                              `/transactions?transaction=${transaction.id}`,
                            );

                            closeSearch();
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                        >
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              isCredit
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-rose-50 text-rose-600"
                            }`}
                          >
                            <FileText
                              size={18}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {party?.name ??
                                "Unknown party"}
                            </p>

                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {
                                transaction.description
                              }
                            </p>

                            <p className="mt-1 text-[11px] text-slate-400">
                              {formatTransactionDate(
                                transaction.transactionDate,
                              )}
                            </p>
                          </div>

                          <p
                            className={`whitespace-nowrap text-xs font-semibold ${
                              isCredit
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {isCredit
                              ? "+"
                              : "-"}

                            {formatCurrency(
                              transaction.amount,
                            )}
                          </p>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          )}
      </div>

      {/* RIGHT ACTIONS */}

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          title="Notifications"
          onClick={() =>
            toast.info(
              "No new notifications.",
            )
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <Bell size={18} />
        </button>

        <button
          type="button"
          disabled={!canWrite}
          title={canWrite ? "Add transaction" : "Your role has read-only access"}
          onClick={() =>
            openTransactionModal(
              "CREDIT",
            )
          }
          className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Plus size={17} />

          <span className="hidden sm:inline">
            Add Transaction
          </span>
        </button>
      </div>
    </header>
  );
}
