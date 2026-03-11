import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { formatDate, isOverdue } from "@/lib/date";

interface NewLoanForm {
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

interface LoanBook {
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

interface LoanRecord {
  id: number;
  bookId: number;
  bookCopyId?: number;
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
  isOverdue: boolean;
}

interface LoanRequestRecord {
  id: number;
  bookId: number;
  requestedCopyId?: number;
  copyCode?: string;
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

const defaultLoan: NewLoanForm = {
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

const DAY_MS = 24 * 60 * 60 * 1000;

const getRemainingDays = (expectedReturnAt?: string): number | null => {
  if (!expectedReturnAt) return null;
  const due = new Date(expectedReturnAt);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.ceil((startDue.getTime() - startToday.getTime()) / DAY_MS);
};

const normalizeStatusFilter = (value: string | null): "borrowed" | "returned" | "lost" | "overdue" | null => {
  if (!value) return null;
  if (value === "borrowed" || value === "returned" || value === "lost" || value === "overdue") return value;
  return null;
};

export const LoansPage = () => {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<NewLoanForm>(defaultLoan);
  const [decisionState, setDecisionState] = useState<
    Record<number, { requestedCopyId: string; expectedReturnAt: string; adminNote: string; allowOverride: boolean }>
  >({});
  const queryClient = useQueryClient();

  const booksQuery = useQuery({
    queryKey: ["books", "loan-options", "copy-aware"],
    queryFn: () =>
      apiRequest<{ items: LoanBook[] }>("/api/books", { params: { includeArchived: 0, includeCopies: 1, limit: 200, sort: "title" } })
  });

  const loansQuery = useQuery({
    queryKey: ["loans"],
    queryFn: () => apiRequest<{ loans: LoanRecord[] }>("/api/loans")
  });

  const requestsQuery = useQuery({
    queryKey: ["loan-requests", "requested"],
    queryFn: () => apiRequest<{ requests: LoanRequestRecord[] }>("/api/loan-requests", { params: { status: "requested", limit: 200 } })
  });

  const selectedBook = useMemo(
    () => (booksQuery.data?.items ?? []).find((book) => String(book.id) === form.bookId),
    [booksQuery.data?.items, form.bookId]
  );
  const selectableCopies = selectedBook?.copies ?? [];

  const createLoanMutation = useMutation({
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
      setForm(defaultLoan);
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      alert((error as Error).message);
    }
  });

  const returnMutation = useMutation({
    mutationFn: (loanId: number) =>
      apiRequest(`/api/loans/${loanId}/return`, {
        method: "POST",
        body: JSON.stringify({})
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const deleteLoanMutation = useMutation({
    mutationFn: (loanId: number) =>
      apiRequest(`/api/loans/${loanId}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      alert((error as Error).message);
    }
  });

  const decideRequestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      const state = decisionState[id] ?? {
        requestedCopyId: "",
        expectedReturnAt: "",
        adminNote: "",
        allowOverride: false
      };
      return apiRequest(`/api/loan-requests/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({
          status,
          requestedCopyId: state.requestedCopyId ? Number(state.requestedCopyId) : undefined,
          expectedReturnAt: state.expectedReturnAt || undefined,
          adminNote: state.adminNote || undefined,
          allowOverride: state.allowOverride
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-requests"] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      alert((error as Error).message);
    }
  });

  if (booksQuery.isLoading || loansQuery.isLoading || requestsQuery.isLoading) return <LoadingState />;
  if (booksQuery.isError || loansQuery.isError || requestsQuery.isError) {
    return (
      <ErrorState
        message={(booksQuery.error as Error)?.message || (loansQuery.error as Error)?.message || (requestsQuery.error as Error)?.message || "Failed"}
      />
    );
  }

  const books = booksQuery.data?.items ?? [];
  const loans = loansQuery.data?.loans ?? [];
  const requests = requestsQuery.data?.requests ?? [];
  const statusFilter = normalizeStatusFilter(searchParams.get("status"));
  const focusRequestId = searchParams.get("focusRequest") ? Number(searchParams.get("focusRequest")) : undefined;
  const prefillBookId = searchParams.get("bookId");
  const prefillCopyId = searchParams.get("copyId");

  const filteredLoans = loans.filter((loan) => {
    if (!statusFilter) return true;
    if (statusFilter === "overdue") return loan.status === "borrowed" && isOverdue(loan.expectedReturnAt, loan.status);
    return loan.status === statusFilter;
  });

  const dueCalendar = filteredLoans
    .filter((loan) => loan.status === "borrowed" && loan.expectedReturnAt)
    .sort((a, b) => new Date(a.expectedReturnAt || "").getTime() - new Date(b.expectedReturnAt || "").getTime())
    .reduce<Record<string, LoanRecord[]>>((acc, loan) => {
      const key = loan.expectedReturnAt?.slice(0, 10) ?? "No due date";
      acc[key] = acc[key] ?? [];
      acc[key].push(loan);
      return acc;
    }, {});

  const applyLookupCode = () => {
    const text = form.lookupCode.trim();
    if (!text) return;

    const qrMatch = text.match(/\/b\/([a-zA-Z0-9-]+)/i);
    const normalized = qrMatch?.[1]?.trim() ?? text;
    let matchedBook: LoanBook | undefined;
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
          book.accessionCode.toLowerCase() === normalized.toLowerCase()
      );
    }

    if (!matchedBook) {
      matchedBook = books.find(
        (book) =>
          (book.title ?? "").toLowerCase().includes(normalized.toLowerCase()) ||
          book.publicCode.toLowerCase().includes(normalized.toLowerCase()) ||
          book.accessionCode.toLowerCase().includes(normalized.toLowerCase())
      );
    }

    if (!matchedBook) {
      alert("No book/copy found with this code.");
      return;
    }

    setForm((prev) => ({
      ...prev,
      bookId: String(matchedBook!.id),
      bookCopyId: matchedCopyId ?? prev.bookCopyId
    }));
  };

  useEffect(() => {
    if (!focusRequestId) return;
    const node = document.getElementById(`loan-request-${focusRequestId}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusRequestId, requests.length]);

  useEffect(() => {
    if (!prefillBookId) return;
    const target = books.find((book) => String(book.id) === prefillBookId);
    if (!target) return;

    setForm((prev) => {
      if (prev.bookId === prefillBookId && (!prefillCopyId || prev.bookCopyId === prefillCopyId)) {
        return prev;
      }

      const selectedCopy =
        prefillCopyId && target.copies?.some((copy) => String(copy.id) === prefillCopyId) ? prefillCopyId : "";

      return {
        ...prev,
        bookId: prefillBookId,
        bookCopyId: selectedCopy
      };
    });
  }, [books, prefillBookId, prefillCopyId]);

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Borrow Menu</h2>
        <p className="text-sm text-app-muted">
          Approve public demands, create manual borrow entries, manage history, due timeline, and calendar view.
        </p>
      </header>

      <section id="requests" className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Public Borrow Demands</h3>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-app-muted">No pending requests.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {requests.map((request) => {
              const book = books.find((item) => item.id === request.bookId);
              const copies = book?.copies ?? [];
              const state = decisionState[request.id] ?? {
                requestedCopyId: request.requestedCopyId ? String(request.requestedCopyId) : "",
                expectedReturnAt: request.expectedReturnAt ?? "",
                adminNote: "",
                allowOverride: false
              };

              return (
                <article
                  id={`loan-request-${request.id}`}
                  key={request.id}
                  className={`rounded-xl border p-3 ${
                    focusRequestId === request.id ? "border-app-primary bg-blue-50/50" : "border-app-border"
                  }`}
                >
                  <p className="font-medium">
                    {request.bookTitle || "Unknown book"} ({request.publicCode || "-"})
                  </p>
                  <p className="text-sm text-app-muted">
                    {request.requesterName} | Org: {request.requesterOrganization || "-"} | Designation: {request.requesterDesignation || "-"}
                  </p>
                  <p className="text-sm text-app-muted">
                    Address: {request.requesterAddress || "-"} | Phone: {request.requesterPhone || request.requesterPhoneMasked || "-"}
                  </p>
                  <p className="text-xs text-app-muted">
                    Email: {request.requesterEmail || "-"} | Borrow Date: {formatDate(request.borrowedAt)} | Return Date: {formatDate(request.expectedReturnAt)} | Requested: {formatDate(request.requestedAt)}
                  </p>
                  {request.note ? <p className="mt-1 text-sm text-app-muted">Note: {request.note}</p> : null}

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <select
                      value={state.requestedCopyId}
                      onChange={(event) =>
                        setDecisionState((prev) => ({
                          ...prev,
                          [request.id]: { ...state, requestedCopyId: event.target.value }
                        }))
                      }
                      className="rounded-xl border border-app-border px-3 py-2 text-sm"
                    >
                      <option value="">Auto select available copy</option>
                      {copies.map((copy) => (
                        <option key={copy.id} value={copy.id}>
                          {copy.copyCode} ({copy.status})
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={state.expectedReturnAt}
                      onChange={(event) =>
                        setDecisionState((prev) => ({
                          ...prev,
                          [request.id]: { ...state, expectedReturnAt: event.target.value }
                        }))
                      }
                      className="rounded-xl border border-app-border px-3 py-2 text-sm"
                    />
                    <input
                      value={state.adminNote}
                      onChange={(event) =>
                        setDecisionState((prev) => ({
                          ...prev,
                          [request.id]: { ...state, adminNote: event.target.value }
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
                        checked={state.allowOverride}
                        onChange={(event) =>
                          setDecisionState((prev) => ({
                            ...prev,
                            [request.id]: { ...state, allowOverride: event.target.checked }
                          }))
                        }
                      />
                      Allow override if selected copy already borrowed
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => decideRequestMutation.mutate({ id: request.id, status: "rejected" })}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs text-rose-700"
                      >
                        Deny
                      </button>
                      <button
                        type="button"
                        onClick={() => decideRequestMutation.mutate({ id: request.id, status: "approved" })}
                        className="rounded-lg bg-app-primary px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Approve and Borrow
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Manual Borrow Entry</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            value={form.lookupCode}
            onChange={(event) => setForm((prev) => ({ ...prev, lookupCode: event.target.value }))}
            placeholder="Search/Scan barcode, QR, public code, accession code..."
            className="rounded-xl border border-app-border px-3 py-2 text-sm md:col-span-2"
          />
          <button
            type="button"
            onClick={applyLookupCode}
            className="rounded-lg border border-app-border px-4 py-2 text-sm"
          >
            Find by Code/Scan
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            value={form.bookId}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                bookId: event.target.value,
                bookCopyId: ""
              }))
            }
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

          <input
            value={form.borrowerName}
            onChange={(event) => setForm((prev) => ({ ...prev, borrowerName: event.target.value }))}
            placeholder="Borrower name"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <input
            value={form.borrowerOrganization}
            onChange={(event) => setForm((prev) => ({ ...prev, borrowerOrganization: event.target.value }))}
            placeholder="Organization"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <input
            value={form.borrowerDesignation}
            onChange={(event) => setForm((prev) => ({ ...prev, borrowerDesignation: event.target.value }))}
            placeholder="Designation"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <input
            value={form.borrowerPhone}
            onChange={(event) => setForm((prev) => ({ ...prev, borrowerPhone: event.target.value }))}
            placeholder="Mobile number"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <input
            value={form.borrowerEmail}
            onChange={(event) => setForm((prev) => ({ ...prev, borrowerEmail: event.target.value }))}
            placeholder="Email"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.borrowedAt}
            onChange={(event) => setForm((prev) => ({ ...prev, borrowedAt: event.target.value }))}
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.expectedReturnAt}
            onChange={(event) => setForm((prev) => ({ ...prev, expectedReturnAt: event.target.value }))}
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <textarea
            value={form.borrowerAddress}
            onChange={(event) => setForm((prev) => ({ ...prev, borrowerAddress: event.target.value }))}
            placeholder="Address"
            className="min-h-20 rounded-xl border border-app-border px-3 py-2 text-sm md:col-span-2"
          />
          <textarea
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="Notes"
            className="min-h-20 rounded-xl border border-app-border px-3 py-2 text-sm md:col-span-2"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-app-muted">
            <input
              type="checkbox"
              checked={form.allowOverride}
              onChange={(event) => setForm((prev) => ({ ...prev, allowOverride: event.target.checked }))}
            />
            Allow intentional double-borrow for same copy
          </label>

          <button
            type="button"
            onClick={() => createLoanMutation.mutate()}
            disabled={!form.bookId || !form.borrowerName || createLoanMutation.isPending}
            className="rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createLoanMutation.isPending ? "Saving..." : "Create Borrow Entry"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Borrow Due Calendar View</h3>
        {Object.keys(dueCalendar).length === 0 ? (
          <p className="mt-2 text-sm text-app-muted">No due entries available.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {Object.entries(dueCalendar).map(([date, items]) => (
              <article key={date} className="rounded-xl border border-app-border p-3">
                <p className="font-medium">{formatDate(date)}</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {items.map((item) => {
                    const days = getRemainingDays(item.expectedReturnAt);
                    return (
                      <li key={item.id} className="rounded-lg bg-app-surface p-2">
                        <p className="font-medium">
                          {item.bookTitle || "Unknown"} ({item.copyCode || "-"})
                        </p>
                        <p className="text-xs text-app-muted">
                          {item.borrowerName} | Remaining:{" "}
                          {days === null ? "-" : days >= 0 ? `${days} day(s)` : `${Math.abs(days)} day(s) overdue`}
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
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-heading text-base">Borrow History</h3>
          {statusFilter ? (
            <p className="text-xs text-app-muted">
              Filter: <strong>{statusFilter}</strong>
            </p>
          ) : null}
        </div>
        {filteredLoans.length === 0 ? (
          <EmptyState title="No borrow history yet" description="Borrow records will appear here." />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-app-muted">
                  <th className="p-2">Book/Copy</th>
                  <th className="p-2">Borrower</th>
                  <th className="p-2">Borrow</th>
                  <th className="p-2">Return</th>
                  <th className="p-2">Due</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan) => {
                  const remaining = getRemainingDays(loan.expectedReturnAt);
                  return (
                    <tr key={loan.id} className="border-t border-app-border align-top">
                      <td className="p-2">
                        <p className="font-medium">{loan.bookTitle || "Unknown"}</p>
                        <p className="text-xs text-app-muted">
                          {loan.accessionCode || "-"} | {loan.copyCode || "-"}
                        </p>
                      </td>
                      <td className="p-2">
                        <p>{loan.borrowerName}</p>
                        <p className="text-xs text-app-muted">{loan.borrowerOrganization || "-"}</p>
                        <p className="text-xs text-app-muted">{loan.borrowerDesignation || "-"}</p>
                        <p className="text-xs text-app-muted">{loan.borrowerPhone || "-"}</p>
                      </td>
                      <td className="p-2">{formatDate(loan.borrowedAt)}</td>
                      <td className="p-2">{formatDate(loan.returnedAt)}</td>
                      <td className="p-2">
                        <p>{formatDate(loan.expectedReturnAt)}</p>
                        <p className="text-xs text-app-muted">
                          {remaining === null
                            ? "-"
                            : remaining >= 0
                              ? `${remaining} day(s) left`
                              : `${Math.abs(remaining)} day(s) overdue`}
                        </p>
                      </td>
                      <td className="p-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            loan.status === "returned"
                              ? "bg-emerald-100 text-emerald-700"
                              : isOverdue(loan.expectedReturnAt, loan.status)
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {loan.status}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-col gap-2">
                          {loan.status === "borrowed" ? (
                            <button
                              type="button"
                              onClick={() => returnMutation.mutate(loan.id)}
                              className="rounded-lg border border-app-border px-3 py-1 text-xs"
                            >
                              Mark Returned
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              if (!confirm("Delete this borrow record?")) return;
                              deleteLoanMutation.mutate(loan.id);
                            }}
                            className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-700"
                          >
                            Delete Loan
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
