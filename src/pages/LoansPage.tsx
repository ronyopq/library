import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { formatDate, isOverdue } from "@/lib/date";

interface NewLoanForm {
  bookId: string;
  borrowerName: string;
  borrowerPhone: string;
  borrowerEmail: string;
  expectedReturnAt: string;
  note: string;
  allowOverride: boolean;
}

const defaultLoan: NewLoanForm = {
  bookId: "",
  borrowerName: "",
  borrowerPhone: "",
  borrowerEmail: "",
  expectedReturnAt: "",
  note: "",
  allowOverride: false
};

export const LoansPage = () => {
  const [form, setForm] = useState<NewLoanForm>(defaultLoan);
  const queryClient = useQueryClient();

  const booksQuery = useQuery({
    queryKey: ["books", "loan-options"],
    queryFn: () => apiRequest<{ items: any[] }>("/api/books", { params: { includeArchived: 0, limit: 300, sort: "title" } })
  });

  const loansQuery = useQuery({
    queryKey: ["loans"],
    queryFn: () => apiRequest<{ loans: any[] }>("/api/loans")
  });

  const createLoanMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/loans", {
        method: "POST",
        body: JSON.stringify({
          bookId: Number(form.bookId),
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

  if (booksQuery.isLoading || loansQuery.isLoading) return <LoadingState />;
  if (booksQuery.isError || loansQuery.isError) {
    return <ErrorState message={(booksQuery.error as Error)?.message || (loansQuery.error as Error)?.message || "Failed"} />;
  }

  const books = booksQuery.data?.items ?? [];
  const loans = loansQuery.data?.loans ?? [];

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
        <h2 className="font-heading text-xl">Lending / Borrowed for Reading</h2>
        <p className="text-sm text-ink-500">??? ???? ? ???? ?????????</p>
      </header>

      <section className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
        <h3 className="font-heading text-base">Create Loan</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            value={form.bookId}
            onChange={(event) => setForm((prev) => ({ ...prev, bookId: event.target.value }))}
            className="rounded-xl border border-brand-200 px-3 py-2 text-sm"
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
          <input
            value={form.borrowerName}
            onChange={(event) => setForm((prev) => ({ ...prev, borrowerName: event.target.value }))}
            placeholder="Borrower name"
            className="rounded-xl border border-brand-200 px-3 py-2 text-sm"
          />
          <input
            value={form.borrowerPhone}
            onChange={(event) => setForm((prev) => ({ ...prev, borrowerPhone: event.target.value }))}
            placeholder="Phone"
            className="rounded-xl border border-brand-200 px-3 py-2 text-sm"
          />
          <input
            value={form.borrowerEmail}
            onChange={(event) => setForm((prev) => ({ ...prev, borrowerEmail: event.target.value }))}
            placeholder="Email"
            className="rounded-xl border border-brand-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.expectedReturnAt}
            onChange={(event) => setForm((prev) => ({ ...prev, expectedReturnAt: event.target.value }))}
            className="rounded-xl border border-brand-200 px-3 py-2 text-sm"
          />
          <input
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="Note"
            className="rounded-xl border border-brand-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-ink-600">
            <input
              type="checkbox"
              checked={form.allowOverride}
              onChange={(event) => setForm((prev) => ({ ...prev, allowOverride: event.target.checked }))}
            />
            Allow double-lending intentionally
          </label>

          <button
            type="button"
            onClick={() => createLoanMutation.mutate()}
            disabled={!form.bookId || !form.borrowerName || createLoanMutation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createLoanMutation.isPending ? "Saving..." : "Create Loan"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
        <h3 className="font-heading text-base">Loan History</h3>
        {loans.length === 0 ? (
          <EmptyState title="No loans yet" description="??? ???? ???? ???? ????? ???? ????" />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500">
                  <th className="p-2">Book</th>
                  <th className="p-2">Borrower</th>
                  <th className="p-2">Borrowed</th>
                  <th className="p-2">Expected</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id} className="border-t border-brand-100">
                    <td className="p-2">
                      <p className="font-medium">{loan.bookTitle || "Unknown"}</p>
                      <p className="text-xs text-ink-500">{loan.accessionCode || "-"}</p>
                    </td>
                    <td className="p-2">{loan.borrowerName}</td>
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
                          className="rounded-lg border border-brand-200 px-3 py-1 text-xs"
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