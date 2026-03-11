import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@shared/types";
import { Link } from "react-router-dom";
import { BellRing } from "lucide-react";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { isCurrentUserAdmin } from "@/lib/adminAuth";
import { formatDate } from "@/lib/date";

const cardStyle =
  "rounded-2xl border border-app-border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-app-primary";

export const DashboardPage = () => {
  const isAdmin = isCurrentUserAdmin();

  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DashboardStats>("/api/dashboard")
  });

  const requestQuery = useQuery({
    queryKey: ["loan-requests", "dashboard-notify"],
    queryFn: () => apiRequest<{ requests: any[] }>("/api/loan-requests", { params: { status: "requested", limit: 6 } })
  });

  const reviewsQuery = useQuery({
    queryKey: ["admin-reviews", "dashboard-notify"],
    queryFn: () => apiRequest<{ reviews: any[] }>("/api/reviews", { params: { limit: 6 } }),
    enabled: isAdmin
  });

  if (query.isLoading || requestQuery.isLoading || (isAdmin && reviewsQuery.isLoading)) {
    return <LoadingState />;
  }

  if (query.isError || requestQuery.isError || (isAdmin && reviewsQuery.isError)) {
    return (
      <ErrorState
        message={
          (query.error as Error)?.message ||
          (requestQuery.error as Error)?.message ||
          (isAdmin ? (reviewsQuery.error as Error)?.message : "") ||
          "Failed to load dashboard"
        }
        retry={() => {
          query.refetch();
          requestQuery.refetch();
          if (isAdmin) {
            reviewsQuery.refetch();
          }
        }}
      />
    );
  }

  const stats = query.data;
  if (!stats) {
    return <EmptyState title="No dashboard data" />;
  }

  const pendingRequests = requestQuery.data?.requests ?? [];
  const newReviews = reviewsQuery.data?.reviews ?? [];

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/admin/library" className={cardStyle}>
          <p className="text-xs text-app-muted">Total Books</p>
          <p className="mt-1 font-heading text-2xl">{stats.totalBooks}</p>
        </Link>
        <Link to="/admin/library" className={cardStyle}>
          <p className="text-xs text-app-muted">Total Categories</p>
          <p className="mt-1 font-heading text-2xl">{stats.totalCategories}</p>
        </Link>
        <Link to="/admin/library" className={cardStyle}>
          <p className="text-xs text-app-muted">Total Authors</p>
          <p className="mt-1 font-heading text-2xl">{stats.totalAuthors}</p>
        </Link>
        <Link to="/admin/library" className={cardStyle}>
          <p className="text-xs text-app-muted">Total Languages</p>
          <p className="mt-1 font-heading text-2xl">{stats.totalLanguages}</p>
        </Link>
        <Link to="/admin/borrow?status=borrowed" className={cardStyle}>
          <p className="text-xs text-app-muted">Borrowed</p>
          <p className="mt-1 font-heading text-2xl text-amber-700">{stats.totalBorrowed}</p>
        </Link>
        <Link to="/admin/borrow?status=overdue" className={cardStyle}>
          <p className="text-xs text-app-muted">Overdue</p>
          <p className="mt-1 font-heading text-2xl text-rose-700">{stats.overdueCount}</p>
        </Link>
        <Link to="/admin/archived" className={cardStyle}>
          <p className="text-xs text-app-muted">Archived</p>
          <p className="mt-1 font-heading text-2xl">{stats.archivedCount}</p>
        </Link>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <BellRing className="h-4 w-4 text-app-primary" />
          <h3 className="font-heading text-base">Notifications</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-app-border p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">New Borrow Requests</p>
              <Link to="/admin/borrow#requests" className="text-xs text-app-primary hover:underline">
                Open Borrow Menu
              </Link>
            </div>
            {pendingRequests.length === 0 ? (
              <p className="mt-2 text-sm text-app-muted">No pending requests.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {pendingRequests.slice(0, 5).map((item) => (
                  <li key={item.id} className="rounded-lg bg-app-surface p-2">
                    <Link to={`/admin/borrow?focusRequest=${item.id}`} className="block">
                      <p className="font-medium">{item.bookTitle || "Unknown book"}</p>
                      <p className="text-xs text-app-muted">
                        {item.requesterName} - {formatDate(item.requestedAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          {isAdmin ? (
            <article className="rounded-xl border border-app-border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">New Comments and Ratings</p>
                <Link to="/admin/reviews" className="text-xs text-app-primary hover:underline">
                  Open Reviews
                </Link>
              </div>
              {newReviews.length === 0 ? (
                <p className="mt-2 text-sm text-app-muted">No recent comments.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {newReviews.slice(0, 5).map((item) => (
                    <li key={item.id} className="rounded-lg bg-app-surface p-2">
                      <Link to={`/admin/reviews?reviewId=${item.id}`} className="block">
                        <p className="font-medium">{item.bookTitle || "Unknown book"}</p>
                        <p className="text-xs text-app-muted">
                          {item.reviewerName} - {item.rating} star - {formatDate(item.createdAt)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SimpleBarChart title="Category Distribution" data={stats.categoryDistribution} />
        <SimpleBarChart title="Language Distribution" data={stats.languageDistribution} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
          <h3 className="font-heading text-base">Latest Added Books</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {stats.recentlyAdded.map((book) => (
              <li key={book.id} className="rounded-xl border border-app-border p-3">
                <Link to={`/admin/books/${book.id}`} className="block">
                  <p className="font-medium text-app-text">{book.title || "Untitled"}</p>
                  <p className="text-app-muted">{book.authors.join(", ") || "No author"}</p>
                  <p className="text-xs text-app-muted">
                    {book.accessionCode} - {formatDate(book.dateAdded)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
          <h3 className="font-heading text-base">Recent Lending</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {stats.recentLoans.map((loan) => (
              <li key={loan.id} className="rounded-xl border border-app-border p-3">
                <Link to="/admin/borrow" className="block">
                  <p className="font-medium text-app-text">{loan.bookTitle || "Unknown Book"}</p>
                  <p className="text-app-muted">{loan.borrowerName}</p>
                  <p className="text-xs text-app-muted">
                    {formatDate(loan.borrowedAt)} - {loan.status}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <article className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Recent Activity</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {stats.recentActivity.map((activity) => (
            <li key={activity.id} className="rounded-xl border border-app-border p-3">
              <p className="font-medium text-app-text">{activity.message}</p>
              <p className="text-xs text-app-muted">
                {activity.action} - {formatDate(activity.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
};
