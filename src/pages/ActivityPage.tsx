import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Pagination } from "@/components/common/Pagination";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/date";

export const ActivityPage = () => {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const query = useQuery({
    queryKey: ["activity"],
    queryFn: () => apiRequest<{ activities: any[] }>("/api/activity", { params: { limit: 500 } })
  });

  const activities = query.data?.activities ?? [];
  const pagedActivities = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return activities.slice(start, start + PAGE_SIZE);
  }, [activities, page]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} retry={() => query.refetch()} />;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Activity Log</h2>
        <p className="text-sm text-app-muted">Book updates, archive actions, borrows, and metadata lookups.</p>
      </header>

      {activities.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <section className="space-y-2">
          {pagedActivities.map((activity) => (
            <article key={activity.id} className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-app-text">{activity.message}</h3>
                <span className="text-xs text-app-muted">{formatDate(activity.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs text-app-muted">
                {activity.action} - {activity.entityType} #{activity.entityId}
              </p>
            </article>
          ))}
        </section>
      )}
      {activities.length > 0 ? <Pagination page={page} pageSize={PAGE_SIZE} total={activities.length} onPageChange={setPage} /> : null}
    </div>
  );
};
