import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/date";

export const ActivityPage = () => {
  const query = useQuery({
    queryKey: ["activity"],
    queryFn: () => apiRequest<{ activities: any[] }>("/api/activity", { params: { limit: 100 } })
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} retry={() => query.refetch()} />;

  const activities = query.data?.activities ?? [];

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
        <h2 className="font-heading text-xl">Activity Log</h2>
        <p className="text-sm text-ink-500">Book update, archive, loan, metadata lookup ???????</p>
      </header>

      {activities.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <section className="space-y-2">
          {activities.map((activity) => (
            <article key={activity.id} className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-ink-900">{activity.message}</h3>
                <span className="text-xs text-ink-400">{formatDate(activity.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-500">
                {activity.action} • {activity.entityType} #{activity.entityId}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};