import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@shared/types";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useI18n } from "@/lib/i18n";

const cardStyle = "rounded-2xl border border-brand-200 bg-white p-4 shadow-soft";

export const DashboardPage = () => {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DashboardStats>("/api/dashboard")
  });

  if (query.isLoading) {
    return <LoadingState />;
  }

  if (query.isError) {
    return <ErrorState message={(query.error as Error).message} retry={() => query.refetch()} />;
  }

  const stats = query.data;
  if (!stats) {
    return <EmptyState title="No dashboard data" />;
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className={cardStyle}>
          <p className="text-xs text-ink-500">{t("dashboard.totalBooks")}</p>
          <p className="mt-1 font-heading text-2xl">{stats.totalBooks}</p>
        </article>
        <article className={cardStyle}>
          <p className="text-xs text-ink-500">{t("dashboard.totalCategories")}</p>
          <p className="mt-1 font-heading text-2xl">{stats.totalCategories}</p>
        </article>
        <article className={cardStyle}>
          <p className="text-xs text-ink-500">{t("dashboard.totalAuthors")}</p>
          <p className="mt-1 font-heading text-2xl">{stats.totalAuthors}</p>
        </article>
        <article className={cardStyle}>
          <p className="text-xs text-ink-500">{t("dashboard.totalLanguages")}</p>
          <p className="mt-1 font-heading text-2xl">{stats.totalLanguages}</p>
        </article>
        <article className={cardStyle}>
          <p className="text-xs text-ink-500">{t("dashboard.borrowed")}</p>
          <p className="mt-1 font-heading text-2xl text-amber-700">{stats.totalBorrowed}</p>
        </article>
        <article className={cardStyle}>
          <p className="text-xs text-ink-500">{t("dashboard.overdue")}</p>
          <p className="mt-1 font-heading text-2xl text-rose-700">{stats.overdueCount}</p>
        </article>
        <article className={cardStyle}>
          <p className="text-xs text-ink-500">{t("dashboard.archived")}</p>
          <p className="mt-1 font-heading text-2xl text-ink-700">{stats.archivedCount}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SimpleBarChart title="Category Distribution" data={stats.categoryDistribution} />
        <SimpleBarChart title="Language Distribution" data={stats.languageDistribution} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={cardStyle}>
          <h3 className="font-heading text-base">Latest Added Books</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {stats.recentlyAdded.map((book) => (
              <li key={book.id} className="rounded-xl border border-brand-100 p-3">
                <p className="font-medium text-ink-900">{book.title || "Untitled"}</p>
                <p className="text-ink-500">{book.authors.join(", ") || "No author"}</p>
                <p className="text-xs text-ink-400">{book.accessionCode} • {formatDate(book.dateAdded)}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className={cardStyle}>
          <h3 className="font-heading text-base">Recent Lending</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {stats.recentLoans.map((loan) => (
              <li key={loan.id} className="rounded-xl border border-brand-100 p-3">
                <p className="font-medium text-ink-900">{loan.bookTitle || "Unknown Book"}</p>
                <p className="text-ink-500">{loan.borrowerName}</p>
                <p className="text-xs text-ink-400">{formatDate(loan.borrowedAt)} • {loan.status}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <article className={cardStyle}>
        <h3 className="font-heading text-base">Recent Activity</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {stats.recentActivity.map((activity) => (
            <li key={activity.id} className="rounded-xl border border-brand-100 p-3">
              <p className="font-medium text-ink-900">{activity.message}</p>
              <p className="text-xs text-ink-500">
                {activity.action} • {formatDate(activity.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
};