import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Pagination } from "@/components/common/Pagination";
import { apiRequest } from "@/lib/api";
import { formatDate, isOverdue } from "@/lib/date";

interface BorrowFormState {
  lookupCode: string;
  bookId: string;
  bookCopyId: string;
  borrowerName: string;
  borrowerOrganization: string;
  borrowerDesignation: string;
  borrowerAddress: string;
  borrowerPhone: string;
  borrowerEmail: string;
  borrowedAt: string;
  expectedReturnAt: string;
  note: string;
  allowOverride: boolean;
}

interface BorrowBookOption {
  id: number;
  title?: string;
  accessionCode: string;
  publicCode: string;
  isArchived: boolean;
  copies?: Array<{
    id: number;
    copyCode: string;
    status: string;
  }>;
}

interface BorrowRecord {
  id: number;
  bookId: number;
  copyCode?: string;
  bookTitle?: string;
  accessionCode?: string;
  borrowerName: string;
  borrowerOrganization?: string;
  borrowerDesignation?: string;
  borrowerAddress?: string;
  borrowerPhone?: string;
  borrowerEmail?: string;
  borrowedAt: string;
  expectedReturnAt?: string;
  returnedAt?: string;
  status: string;
  note?: string;
}

interface BorrowDemandRecord {
  id: number;
  bookId: number;
  requestedCopyId?: number;
  publicCode?: string;
  bookTitle?: string;
  requesterName: string;
  requesterOrganization?: string;
  requesterDesignation?: string;
  requesterAddress?: string;
  requesterPhone?: string;
  requesterPhoneMasked?: string;
  requesterEmail?: string;
  borrowedAt?: string;
  expectedReturnAt?: string;
  note?: string;
  requestedAt: string;
  status: string;
}

const defaultForm: BorrowFormState = {
  lookupCode: "",
  bookId: "",
  bookCopyId: "",
  borrowerName: "",
  borrowerOrganization: "",
  borrowerDesignation: "",
  borrowerAddress: "",
  borrowerPhone: "",
  borrowerEmail: "",
  borrowedAt: "",
  expectedReturnAt: "",
  note: "",
  allowOverride: false
};

const PAGE_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const getRemainingDays = (expectedReturnAt?: string): number | null => {
  if (!expectedReturnAt) return null;
  const dueDate = new Date(expectedReturnAt);
  if (Number.isNaN(dueDate.getTime())) return null;
  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.ceil((startDue.getTime() - startNow.getTime()) / DAY_MS);
};

const statusFilterFromQuery = (value: string | null): "borrowed" | "returned" | "lost" | "overdue" | null => {
  if (!value) return null;
  if (value === "borrowed" || value === "returned" || value === "lost" || value === "overdue") return value;
  return null;
};

export const LoansPage = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<BorrowFormState>(defaultForm);
  const [historySearch, setHistorySearch] = useState("");
  const [requestPage, setRequestPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [decisionState, setDecisionState] = useState<
    Record<number, { requestedCopyId: string; expectedReturnAt: string; adminNote: string; allowOverride: boolean }>
  >({});

  const booksQuery = useQuery({
    queryKey: ["books", "borrow-menu", "copy-aware"],
    queryFn: () =>
      apiRequest<{ items: BorrowBookOption[] }>("/api/books", {
        params: { includeArchived: 0, includeCopies: 1, limit: 200, sort: "title", offset: 0 }
      }),
    placeholderData: (previousData) => previousData
  });

  const borrowsQuery = useQuery({
    queryKey: ["borrows"],
    queryFn: () => apiRequest<{ loans: BorrowRecord[] }>("/api/loans"),
    placeholderData: (previousData) => previousData
  });

  const demandsQuery = useQuery({
    queryKey: ["borrow-demands", "requested"],
    queryFn: () =>
      apiRequest<{ requests: BorrowDemandRecord[] }>("/api/loan-requests", {
        params: { status: "requested", limit: 200 }
      }),
    placeholderData: (previousData) => previousData
  });

  const createBorrowMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/loans", {
        method: "POST",
        body: JSON.stringify({
          bookId: Number(form.bookId),
          bookCopyId: form.bookCopyId ? Number(form.bookCopyId) : undefined,
          borrowerName: form.borrowerName,
          borrowerOrganization: form.borrowerOrganization || undefined,
          borrowerDesignation: form.borrowerDesignation || undefined,
          borrowerAddress: form.borrowerAddress || undefined,
          borrowerPhone: form.borrowerPhone || undefined,
          borrowerEmail: form.borrowerEmail || undefined,
          borrowedAt: form.borrowedAt || undefined,
          expectedReturnAt: form.expectedReturnAt || undefined,
          note: form.note || undefined,
          allowOverride: form.allowOverride
        })
      }),
    onSuccess: () => {
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ["borrows"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["borrow-demands"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => alert((error as Error).message)
  });

  const markReturnedMutation = useMutation({
    mutationFn: (borrowId: number) =>
      apiRequest(`/api/loans/${borrowId}/return`, {
        method: "POST",
        body: JSON.stringify({})
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrows"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => alert((error as Error).message)
  });

  const deleteBorrowMutation = useMutation({
    mutationFn: (borrowId: number) =>
      apiRequest(`/api/loans/${borrowId}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrows"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => alert((error as Error).message)
  });

  const decideDemandMutation = useMutation({
    mutationFn: ({ demandId, status }: { demandId: number; status: "approved" | "rejected" }) => {
      const decision = decisionState[demandId] ?? {
        requestedCopyId: "",
        expectedReturnAt: "",
        adminNote: "",
        allowOverride: false
      };

      return apiRequest(`/api/loan-requests/${demandId}/decision`, {
        method: "POST",
        body: JSON.stringify({
          status,
          requestedCopyId: decision.requestedCopyId ? Number(decision.requestedCopyId) : undefined,
          expectedReturnAt: decision.expectedReturnAt || undefined,
          adminNote: decision.adminNote || undefined,
          allowOverride: decision.allowOverride
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrow-demands"] });
      queryClient.invalidateQueries({ queryKey: ["borrows"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => alert((error as Error).message)
  });

  const books = booksQuery.data?.items ?? [];
  const borrows = borrowsQuery.data?.loans ?? [];
  const demands = demandsQuery.data?.requests ?? [];
  const queryStatusFilter = statusFilterFromQuery(searchParams.get("status"));
  const focusDemandId = searchParams.get("focusRequest") ? Number(searchParams.get("focusRequest")) : undefined;
  const prefillBookId = searchParams.get("bookId");
  const prefillCopyId = searchParams.get("copyId");

  const selectedBook = useMemo(() => books.find((book) => String(book.id) === form.bookId), [books, form.bookId]);
  const selectableCopies = selectedBook?.copies ?? [];

  const filteredBorrows = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase();
    return borrows.filter((borrow) => {
      const statusOk =
        !queryStatusFilter
          ? true
          : queryStatusFilter === "overdue"
            ? borrow.status === "borrowed" && isOverdue(borrow.expectedReturnAt, borrow.status)
            : borrow.status === queryStatusFilter;

      if (!statusOk) return false;
      if (!keyword) return true;

      return [
        borrow.bookTitle,
        borrow.copyCode,
        borrow.accessionCode,
        borrow.borrowerName,
        borrow.borrowerOrganization,
        borrow.borrowerDesignation,
        borrow.borrowerPhone
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [borrows, historySearch, queryStatusFilter]);

  const activeBorrowCount = borrows.filter((item) => item.status === "borrowed").length;
  const overdueCount = borrows.filter((item) => item.status === "borrowed" && isOverdue(item.expectedReturnAt, item.status)).length;
  const returnedCount = borrows.filter((item) => item.status === "returned").length;

  const pagedDemands = demands.slice((requestPage - 1) * PAGE_SIZE, requestPage * PAGE_SIZE);
  const pagedHistory = filteredBorrows.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);

  const dueCalendar = filteredBorrows
    .filter((item) => item.status === "borrowed" && item.expectedReturnAt)
    .sort((a, b) => new Date(a.expectedReturnAt || "").getTime() - new Date(b.expectedReturnAt || "").getTime())
    .slice(0, 16)
    .reduce<Record<string, BorrowRecord[]>>((acc, item) => {
      const key = item.expectedReturnAt?.slice(0, 10) ?? "No due date";
      acc[key] = acc[key] ?? [];
      acc[key].push(item);
      return acc;
    }, {});

  const applyLookupCode = () => {
    const raw = form.lookupCode.trim();
    if (!raw) return;
    const qrMatch = raw.match(/\/b\/([a-zA-Z0-9-]+)/i);
    const normalized = qrMatch?.[1]?.trim() ?? raw;

    let matchedBook: BorrowBookOption | undefined;
    let matchedCopyId: string | undefined;

    for (const book of books) {
      const copy = (book.copies ?? []).find((item) => item.copyCode.toLowerCase() === normalized.toLowerCase());
      if (copy) {
        matchedBook = book;
        matchedCopyId = String(copy.id);
        break;
      }
    }

    if (!matchedBook) {
      matchedBook = books.find(
        (book) =>
          book.publicCode.toLowerCase() === normalized.toLowerCase() ||
          book.accessionCode.toLowerCase() === normalized.toLowerCase() ||
          (book.title ?? "").toLowerCase().includes(normalized.toLowerCase())
      );
    }

    if (!matchedBook) {
      alert("No matching book or copy found.");
      return;
    }

    setForm((prev) => ({
      ...prev,
      bookId: String(matchedBook!.id),
      bookCopyId: matchedCopyId ?? prev.bookCopyId
    }));
  };

  useEffect(() => {
    if (!focusDemandId) return;
    const node = document.getElementById(`borrow-demand-${focusDemandId}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusDemandId, demands.length]);

  useEffect(() => {
    if (!prefillBookId) return;
    const target = books.find((book) => String(book.id) === prefillBookId);
    if (!target) return;

    const selectedCopy = prefillCopyId && target.copies?.some((copy) => String(copy.id) === prefillCopyId) ? prefillCopyId : "";
    setForm((prev) => ({
      ...prev,
      bookId: prefillBookId,
      bookCopyId: selectedCopy
    }));
  }, [books, prefillBookId, prefillCopyId]);

  useEffect(() => {
    setRequestPage(1);
  }, [demands.length]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, queryStatusFilter]);

  if (!booksQuery.data && booksQuery.isLoading) return <LoadingState />;
  if (booksQuery.isError) return <ErrorState message={(booksQuery.error as Error).message} retry={() => booksQuery.refetch()} />;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Borrow Menu</h2>
        <p className="text-sm text-app-muted">International-style borrow operations: demand review, manual checkout, due tracking, and history control.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-app-border bg-white p-3 shadow-card">
          <p className="text-xs text-app-muted">Pending Demands</p>
          <p className="mt-1 font-heading text-2xl text-app-primary">{demands.length}</p>
        </article>
        <article className="rounded-xl border border-app-border bg-white p-3 shadow-card">
          <p className="text-xs text-app-muted">Active Borrows</p>
          <p className="mt-1 font-heading text-2xl text-amber-700">{activeBorrowCount}</p>
        </article>
        <article className="rounded-xl border border-app-border bg-white p-3 shadow-card">
          <p className="text-xs text-app-muted">Overdue</p>
          <p className="mt-1 font-heading text-2xl text-rose-700">{overdueCount}</p>
        </article>
        <article className="rounded-xl border border-app-border bg-white p-3 shadow-card">
          <p className="text-xs text-app-muted">Returned</p>
          <p className="mt-1 font-heading text-2xl text-emerald-700">{returnedCount}</p>
        </article>
      </section>

      <section id="requests" className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-base">Public Borrow Demands</h3>
          {demandsQuery.isFetching ? <span className="text-xs text-app-muted">Updating...</span> : null}
        </div>
        {demandsQuery.isError ? (
          <ErrorState message={(demandsQuery.error as Error).message} retry={() => demandsQuery.refetch()} />
        ) : demands.length === 0 ? (
          <p className="text-sm text-app-muted">No pending borrow demands.</p>
        ) : (
          <div className="space-y-3">
            {pagedDemands.map((demand) => {
              const demandBook = books.find((item) => item.id === demand.bookId);
              const demandCopies = demandBook?.copies ?? [];
              const decision = decisionState[demand.id] ?? {
                requestedCopyId: demand.requestedCopyId ? String(demand.requestedCopyId) : "",
                expectedReturnAt: demand.expectedReturnAt ?? "",
                adminNote: "",
                allowOverride: false
              };

              return (
                <article
                  id={`borrow-demand-${demand.id}`}
                  key={demand.id}
                  className={`rounded-xl border p-3 ${focusDemandId === demand.id ? "border-app-primary bg-blue-50/40" : "border-app-border"}`}
                >
                  <p className="font-medium">
                    {demand.bookTitle || "Unknown book"} ({demand.publicCode || "-"})
                  </p>
                  <p className="text-sm text-app-muted">
                    {demand.requesterName} | {demand.requesterOrganization || "-"} | {demand.requesterDesignation || "-"}
                  </p>
                  <p className="text-sm text-app-muted">
                    {demand.requesterAddress || "-"} | {demand.requesterPhone || demand.requesterPhoneMasked || "-"}
                  </p>
                  <p className="text-xs text-app-muted">
                    Borrow Date: {formatDate(demand.borrowedAt)} | Return Date: {formatDate(demand.expectedReturnAt)} | Requested: {formatDate(demand.requestedAt)}
                  </p>
                  {demand.note ? <p className="mt-1 text-sm text-app-muted">Note: {demand.note}</p> : null}

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <select
                      value={decision.requestedCopyId}
                      onChange={(event) =>
                        setDecisionState((prev) => ({
                          ...prev,
                          [demand.id]: { ...decision, requestedCopyId: event.target.value }
                        }))
                      }
                      className="rounded-xl border border-app-border px-3 py-2 text-sm"
                    >
                      <option value="">Auto select available copy</option>
                      {demandCopies.map((copy) => (
                        <option key={copy.id} value={copy.id}>
                          {copy.copyCode} ({copy.status})
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={decision.expectedReturnAt}
                      onChange={(event) =>
                        setDecisionState((prev) => ({
                          ...prev,
                          [demand.id]: { ...decision, expectedReturnAt: event.target.value }
                        }))
                      }
                      className="rounded-xl border border-app-border px-3 py-2 text-sm"
                    />
                    <input
                      value={decision.adminNote}
                      onChange={(event) =>
                        setDecisionState((prev) => ({
                          ...prev,
                          [demand.id]: { ...decision, adminNote: event.target.value }
                        }))
                      }
                      placeholder="Admin note"
                      className="rounded-xl border border-app-border px-3 py-2 text-sm md:col-span-2"
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-app-muted">
                      <input
                        type="checkbox"
                        checked={decision.allowOverride}
                        onChange={(event) =>
                          setDecisionState((prev) => ({
                            ...prev,
                            [demand.id]: { ...decision, allowOverride: event.target.checked }
                          }))
                        }
                      />
                      Allow override if selected copy is already borrowed
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => decideDemandMutation.mutate({ demandId: demand.id, status: "rejected" })}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs text-rose-700"
                      >
                        Deny
                      </button>
                      <button
                        type="button"
                        onClick={() => decideDemandMutation.mutate({ demandId: demand.id, status: "approved" })}
                        className="rounded-lg bg-app-primary px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            <Pagination page={requestPage} pageSize={PAGE_SIZE} total={demands.length} onPageChange={setRequestPage} isBusy={demandsQuery.isFetching} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Manual Borrow Entry</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={form.lookupCode}
            onChange={(event) => setForm((prev) => ({ ...prev, lookupCode: event.target.value }))}
            placeholder="Code search / Barcode scan / QR URL / title keyword"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <button type="button" onClick={applyLookupCode} className="rounded-lg border border-app-border px-4 py-2 text-sm">
            Find
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            value={form.bookId}
            onChange={(event) => setForm((prev) => ({ ...prev, bookId: event.target.value, bookCopyId: "" }))}
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          >
            <option value="">Select book</option>
            {books
              .filter((book) => !book.isArchived)
              .map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title || "Untitled"} ({book.accessionCode} | {book.publicCode})
                </option>
              ))}
          </select>

          <select
            value={form.bookCopyId}
            onChange={(event) => setForm((prev) => ({ ...prev, bookCopyId: event.target.value }))}
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          >
            <option value="">Auto select available copy</option>
            {selectableCopies.map((copy) => (
              <option key={copy.id} value={copy.id}>
                {copy.copyCode} ({copy.status})
              </option>
            ))}
          </select>

          <input value={form.borrowerName} onChange={(event) => setForm((prev) => ({ ...prev, borrowerName: event.target.value }))} placeholder="Borrower name" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.borrowerOrganization} onChange={(event) => setForm((prev) => ({ ...prev, borrowerOrganization: event.target.value }))} placeholder="Organization" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.borrowerDesignation} onChange={(event) => setForm((prev) => ({ ...prev, borrowerDesignation: event.target.value }))} placeholder="Designation" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.borrowerPhone} onChange={(event) => setForm((prev) => ({ ...prev, borrowerPhone: event.target.value }))} placeholder="Mobile number" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.borrowerEmail} onChange={(event) => setForm((prev) => ({ ...prev, borrowerEmail: event.target.value }))} placeholder="Email" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input type="date" value={form.borrowedAt} onChange={(event) => setForm((prev) => ({ ...prev, borrowedAt: event.target.value }))} className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input type="date" value={form.expectedReturnAt} onChange={(event) => setForm((prev) => ({ ...prev, expectedReturnAt: event.target.value }))} className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <textarea value={form.borrowerAddress} onChange={(event) => setForm((prev) => ({ ...prev, borrowerAddress: event.target.value }))} placeholder="Address" className="min-h-20 rounded-xl border border-app-border px-3 py-2 text-sm md:col-span-2" />
          <textarea value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} placeholder="Notes" className="min-h-20 rounded-xl border border-app-border px-3 py-2 text-sm md:col-span-2" />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-app-muted">
            <input type="checkbox" checked={form.allowOverride} onChange={(event) => setForm((prev) => ({ ...prev, allowOverride: event.target.checked }))} />
            Allow intentional override for same copy
          </label>
          <button
            type="button"
            onClick={() => createBorrowMutation.mutate()}
            disabled={!form.bookId || !form.borrowerName || createBorrowMutation.isPending}
            className="rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createBorrowMutation.isPending ? "Saving..." : "Create Borrow Entry"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Due Calendar (Upcoming)</h3>
        {Object.keys(dueCalendar).length === 0 ? (
          <p className="mt-2 text-sm text-app-muted">No due entries available.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {Object.entries(dueCalendar).map(([date, items]) => (
              <article key={date} className="rounded-xl border border-app-border p-3">
                <p className="font-medium">{formatDate(date)}</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {items.map((item) => {
                    const daysLeft = getRemainingDays(item.expectedReturnAt);
                    return (
                      <li key={item.id} className="rounded-lg bg-app-surface p-2">
                        <p className="font-medium">
                          {item.bookTitle || "Unknown"} ({item.copyCode || "-"})
                        </p>
                        <p className="text-xs text-app-muted">
                          {item.borrowerName} | {daysLeft === null ? "-" : daysLeft >= 0 ? `${daysLeft} day(s) left` : `${Math.abs(daysLeft)} day(s) overdue`}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-base">Borrow History</h3>
          <div className="flex items-center gap-2">
            <input
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder="Search history..."
              className="rounded-lg border border-app-border px-3 py-1.5 text-sm"
            />
            {queryStatusFilter ? <p className="text-xs text-app-muted">Filter: {queryStatusFilter}</p> : null}
          </div>
        </div>

        {borrowsQuery.isError ? (
          <ErrorState message={(borrowsQuery.error as Error).message} retry={() => borrowsQuery.refetch()} />
        ) : filteredBorrows.length === 0 ? (
          <EmptyState title="No borrow records found" description="Borrow records will appear here." />
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-app-muted">
                    <th className="p-2">Book / Copy</th>
                    <th className="p-2">Borrower</th>
                    <th className="p-2">Borrow Date</th>
                    <th className="p-2">Return Date</th>
                    <th className="p-2">Due / Remaining</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedHistory.map((borrow) => {
                    const remaining = getRemainingDays(borrow.expectedReturnAt);
                    return (
                      <tr key={borrow.id} className="border-t border-app-border align-top">
                        <td className="p-2">
                          <p className="font-medium">{borrow.bookTitle || "Unknown"}</p>
                          <p className="text-xs text-app-muted">
                            {borrow.accessionCode || "-"} | {borrow.copyCode || "-"}
                          </p>
                        </td>
                        <td className="p-2">
                          <p>{borrow.borrowerName}</p>
                          <p className="text-xs text-app-muted">{borrow.borrowerOrganization || "-"}</p>
                          <p className="text-xs text-app-muted">{borrow.borrowerDesignation || "-"}</p>
                          <p className="text-xs text-app-muted">{borrow.borrowerPhone || "-"}</p>
                        </td>
                        <td className="p-2">{formatDate(borrow.borrowedAt)}</td>
                        <td className="p-2">{formatDate(borrow.returnedAt)}</td>
                        <td className="p-2">
                          <p>{formatDate(borrow.expectedReturnAt)}</p>
                          <p className="text-xs text-app-muted">
                            {remaining === null ? "-" : remaining >= 0 ? `${remaining} day(s) left` : `${Math.abs(remaining)} day(s) overdue`}
                          </p>
                        </td>
                        <td className="p-2">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              borrow.status === "returned"
                                ? "bg-emerald-100 text-emerald-700"
                                : isOverdue(borrow.expectedReturnAt, borrow.status)
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {borrow.status}
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-col gap-2">
                            {borrow.status === "borrowed" ? (
                              <button
                                type="button"
                                onClick={() => markReturnedMutation.mutate(borrow.id)}
                                className="rounded-lg border border-app-border px-3 py-1 text-xs"
                              >
                                Mark Returned
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                if (!confirm("Delete this borrow record?")) return;
                                deleteBorrowMutation.mutate(borrow.id);
                              }}
                              className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-700"
                            >
                              Delete Borrow
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={historyPage} pageSize={PAGE_SIZE} total={filteredBorrows.length} onPageChange={setHistoryPage} isBusy={borrowsQuery.isFetching} />
          </div>
        )}
      </section>
    </div>
  );
};
