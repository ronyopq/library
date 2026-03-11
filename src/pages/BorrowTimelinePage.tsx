import { MessageSquareText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Pagination } from "@/components/common/Pagination";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/date";

interface TimelineLoan {
  id: number;
  bookId: number;
  copyCode?: string;
  bookTitle?: string;
  borrowerName: string;
  borrowerDesignation?: string;
  borrowerPhone?: string;
  borrowedAt: string;
  expectedReturnAt?: string;
  returnedAt?: string;
  note?: string;
  status: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const calculateReadingDays = (borrowedAt?: string, returnedAt?: string): number | null => {
  if (!borrowedAt) return null;
  const start = new Date(borrowedAt).getTime();
  const end = returnedAt ? new Date(returnedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.max(1, Math.ceil((end - start) / DAY_MS));
};

export const BorrowTimelinePage = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  useEffect(() => {
    setPage(1);
  }, [search]);

  const loansQuery = useQuery({
    queryKey: ["loans", "timeline"],
    queryFn: () => apiRequest<{ loans: TimelineLoan[] }>("/api/loans")
  });

  const allLoans = loansQuery.data?.loans ?? [];
  const keyword = search.trim().toLowerCase();
  const loans = useMemo(
    () =>
      allLoans.filter((loan) => {
        if (!keyword) return true;
        return [loan.bookTitle, loan.copyCode, loan.borrowerName, loan.borrowerDesignation, loan.borrowerPhone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      }),
    [allLoans, keyword]
  );
  const pagedLoans = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return loans.slice(start, start + PAGE_SIZE);
  }, [loans, page]);

  if (loansQuery.isLoading) return <LoadingState />;
  if (loansQuery.isError) return <ErrorState message={(loansQuery.error as Error).message} />;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Book Borrow Timeline</h2>
        <p className="text-sm text-app-muted">Complete borrow history with borrower profile, dates, and reading duration.</p>
      </header>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by book, copy code, borrower, designation, mobile..."
          className="w-full rounded-xl border border-app-border px-3 py-2 text-sm"
        />
      </section>

      {loans.length === 0 ? (
        <EmptyState title="No borrow records found" />
      ) : (
        <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
          <div className="space-y-4">
            {pagedLoans.map((loan) => {
              const totalDays = calculateReadingDays(loan.borrowedAt, loan.returnedAt);
              return (
                <article key={loan.id} className="relative rounded-xl border border-app-border p-4">
                  <div className="absolute left-5 top-6 h-[calc(100%-28px)] w-px bg-app-border" />
                  <div className="relative ml-8 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link to={`/admin/books/${loan.bookId}`} className="font-medium text-app-primary hover:underline">
                          {loan.bookTitle || "Untitled"}
                        </Link>
                        <p className="text-xs text-app-muted">Copy: {loan.copyCode || "-"}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          loan.status === "returned"
                            ? "bg-emerald-100 text-emerald-700"
                            : loan.status === "lost"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {loan.status}
                      </span>
                    </div>

                    <div className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <p>
                        <strong>Borrower:</strong> {loan.borrowerName}
                      </p>
                      <p>
                        <strong>Designation:</strong> {loan.borrowerDesignation || "-"}
                      </p>
                      <p>
                        <strong>Mobile:</strong> {loan.borrowerPhone || "-"}
                      </p>
                      <p>
                        <strong>Total Days:</strong> {totalDays ?? "-"}
                      </p>
                      <p>
                        <strong>Borrow Date:</strong> {formatDate(loan.borrowedAt)}
                      </p>
                      <p>
                        <strong>Return Date:</strong> {formatDate(loan.returnedAt)}
                      </p>
                      <p>
                        <strong>Expected Return:</strong> {formatDate(loan.expectedReturnAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-app-muted">
                      <MessageSquareText className="h-4 w-4" />
                      <span>{loan.note ? loan.note : "No comment"}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {loans.length > 0 ? <Pagination page={page} pageSize={PAGE_SIZE} total={loans.length} onPageChange={setPage} /> : null}
    </div>
  );
};
