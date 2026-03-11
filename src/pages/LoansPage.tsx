import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { formatDate, isOverdue } from "@/lib/date";

interface NewLoanForm {
  bookId: string;
  bookCopyId: string;
  borrowerName: string;
  borrowerPhone: string;
  borrowerEmail: string;
  expectedReturnAt: string;
  note: string;
  allowOverride: boolean;
}

interface LoanBook {
  id: number;
  title?: string;
  accessionCode: string;
  isArchived: boolean;
  copies?: Array<{
    id: number;
    copyCode: string;
    status: string;
  }>;
}

interface LoanRequestRecord {
  id: number;
  bookId: number;
  requestedCopyId?: number;
  copyCode?: string;
  publicCode?: string;
  bookTitle?: string;
  requesterName: string;
  requesterPhone?: string;
  requesterPhoneMasked?: string;
  requesterEmail?: string;
  expectedReturnAt?: string;
  note?: string;
  requestedAt: string;
  status: string;
}

const defaultLoan: NewLoanForm = {
  bookId: "",
  bookCopyId: "",
  borrowerName: "",
  borrowerPhone: "",
  borrowerEmail: "",
  expectedReturnAt: "",
  note: "",
  allowOverride: false
};

export const LoansPage = () => {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<NewLoanForm>(defaultLoan);
  const [decisionState, setDecisionState] = useState<Record<number, { requestedCopyId: string; expectedReturnAt: string; adminNote: string; allowOverride: boolean }>>({});
  const queryClient = useQueryClient();

  const booksQuery = useQuery({
    queryKey: ["books", "loan-options", "copy-aware"],
    queryFn: () =>
      apiRequest<{ items: LoanBook[] }>("/api/books", { params: { includeArchived: 0, includeCopies: 1, limit: 300, sort: "title" } })
  });

  const loansQuery = useQuery({
    queryKey: ["loans"],
    queryFn: () => apiRequest<{ loans: any[] }>("/api/loans")
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
          borrowerPhone: form.borrowerPhone || undefined,
          borrowerEmail: form.borrowerEmail || undefined,
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

  const decideRequestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      const state = decisionState[id] ?? { requestedCopyId: "", expectedReturnAt: "", adminNote: "", allowOverride: false };
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
  const statusFilter = searchParams.get("status");
  const focusRequestId = searchParams.get("focusRequest") ? Number(searchParams.get("focusRequest")) : undefined;

  const filteredLoans = loans.filter((loan) => {
    if (!statusFilter) return true;
    if (statusFilter === "overdue") return loan.status === "borrowed" && isOverdue(loan.expectedReturnAt, loan.status);
    return loan.status === statusFilter;
  });

  useEffect(() => {
    if (!focusRequestId) return;
    const node = document.getElementById(`loan-request-${focusRequestId}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusRequestId, requests.length]);

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Loan Management</h2>
        <p className="text-sm text-app-muted">Handle public requests, create manual loans, and manage returns copy-wise.</p>
      </header>

      <section id="requests" className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Pending Borrow Requests</h3>
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
                    Requested by {request.requesterName} ({request.requesterPhone || request.requesterPhoneMasked || "no phone"}) on {formatDate(request.requestedAt)}
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
                      Allow override if selected copy is already borrowed
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => decideRequestMutation.mutate({ id: request.id, status: "rejected" })}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs text-rose-700"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => decideRequestMutation.mutate({ id: request.id, status: "approved" })}
                        className="rounded-lg bg-app-primary px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Approve and Loan
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
        <h3 className="font-heading text-base">Create Manual Loan</h3>
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
                  {book.title || "Untitled"} ({book.accessionCode})
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
            value={form.borrowerPhone}
            onChange={(event) => setForm((prev) => ({ ...prev, borrowerPhone: event.target.value }))}
            placeholder="Phone"
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
            value={form.expectedReturnAt}
            onChange={(event) => setForm((prev) => ({ ...prev, expectedReturnAt: event.target.value }))}
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <input
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="Note"
            className="rounded-xl border border-app-border px-3 py-2 text-sm md:col-span-2"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-app-muted">
            <input
              type="checkbox"
              checked={form.allowOverride}
              onChange={(event) => setForm((prev) => ({ ...prev, allowOverride: event.target.checked }))}
            />
            Allow intentional double-lending
          </label>

          <button
            type="button"
            onClick={() => createLoanMutation.mutate()}
            disabled={!form.bookId || !form.borrowerName || createLoanMutation.isPending}
            className="rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createLoanMutation.isPending ? "Saving..." : "Create Loan"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-heading text-base">Loan History</h3>
          {statusFilter ? (
            <p className="text-xs text-app-muted">
              Filter: <strong>{statusFilter}</strong>
            </p>
          ) : null}
        </div>
        {filteredLoans.length === 0 ? (
          <EmptyState title="No loans yet" description="Created loans will appear here." />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-app-muted">
                  <th className="p-2">Book</th>
                  <th className="p-2">Copy</th>
                  <th className="p-2">Borrower</th>
                  <th className="p-2">Borrowed</th>
                  <th className="p-2">Expected</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((loan) => (
                  <tr key={loan.id} className="border-t border-app-border">
                    <td className="p-2">
                      <p className="font-medium">{loan.bookTitle || "Unknown"}</p>
                      <p className="text-xs text-app-muted">{loan.accessionCode || "-"}</p>
                    </td>
                    <td className="p-2">
                      <p className="font-medium">{loan.copyCode || "-"}</p>
                    </td>
                    <td className="p-2">
                      <p>{loan.borrowerName}</p>
                      <p className="text-xs text-app-muted">{loan.borrowerPhone || "-"}</p>
                    </td>
                    <td className="p-2">{formatDate(loan.borrowedAt)}</td>
                    <td className="p-2">{formatDate(loan.expectedReturnAt)}</td>
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
                      {loan.status === "borrowed" ? (
                        <button
                          type="button"
                          onClick={() => returnMutation.mutate(loan.id)}
                          className="rounded-lg border border-app-border px-3 py-1 text-xs"
                        >
                          Mark Returned
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
