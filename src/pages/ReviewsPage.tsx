import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Pagination } from "@/components/common/Pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { apiRequest } from "@/lib/api";
import { appAlert, appConfirm } from "@/lib/appDialog";
import { formatDate } from "@/lib/date";

interface AdminReview {
  id: number;
  bookId: number;
  bookTitle?: string;
  publicCode?: string;
  reviewerName: string;
  reviewerPhone?: string;
  reviewerPhoneMasked?: string;
  rating: number;
  comment: string;
  isHidden: boolean;
  createdAt: string;
}

export const ReviewsPage = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [editing, setEditing] = useState<Record<number, AdminReview>>({});
  const debouncedSearch = useDebounce(search, 280);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const query = useQuery({
    queryKey: ["admin-reviews", debouncedSearch],
    queryFn: () =>
      apiRequest<{ reviews: AdminReview[] }>("/api/reviews", {
        params: {
          search: debouncedSearch,
          limit: 500
        }
      }),
    placeholderData: (previousData) => previousData
  });

  const updateMutation = useMutation({
    mutationFn: (review: AdminReview) =>
      apiRequest(`/api/reviews/${review.id}`, {
        method: "PUT",
        body: JSON.stringify({
          reviewerName: review.reviewerName,
          reviewerPhone: review.reviewerPhone ?? "",
          rating: review.rating,
          comment: review.comment,
          isHidden: review.isHidden
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["public-book"] });
    },
    onError: (error) => appAlert((error as Error).message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/reviews/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["public-book"] });
    },
    onError: (error) => appAlert((error as Error).message)
  });

  const reviews = query.data?.reviews ?? [];
  const focusReviewId = searchParams.get("reviewId") ? Number(searchParams.get("reviewId")) : undefined;

  const merged = useMemo(
    () =>
      reviews.map((review) => ({
        ...review,
        ...(editing[review.id] ?? {})
      })),
    [reviews, editing]
  );
  const pagedReviews = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return merged.slice(start, start + PAGE_SIZE);
  }, [merged, page]);

  useEffect(() => {
    if (!focusReviewId) return;
    const node = document.getElementById(`review-${focusReviewId}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusReviewId, merged.length]);

  if (!query.data && query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} retry={() => query.refetch()} />;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Review and Rating Management</h2>
        <p className="text-sm text-app-muted">Admin and librarian can edit or delete public comments and ratings.</p>
      </header>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by reviewer, phone, comment, or book..."
          className="w-full rounded-xl border border-app-border px-3 py-2 text-sm"
        />
      </section>

      {query.isFetching && query.data ? <p className="text-sm text-app-muted">Updating reviews...</p> : null}

      {merged.length === 0 ? (
        <EmptyState title="No reviews found" />
      ) : (
        <section className="space-y-3">
          {pagedReviews.map((review) => (
            <article
              id={`review-${review.id}`}
              key={review.id}
              className={`rounded-2xl border bg-white p-4 shadow-card ${
                focusReviewId === review.id ? "border-app-primary bg-blue-50/40" : "border-app-border"
              }`}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={review.reviewerName}
                  onChange={(event) =>
                    setEditing((prev) => ({
                      ...prev,
                      [review.id]: { ...review, reviewerName: event.target.value }
                    }))
                  }
                  className="rounded-lg border border-app-border px-3 py-2 text-sm"
                  placeholder="Reviewer name"
                />
                <input
                  value={review.reviewerPhone ?? ""}
                  onChange={(event) =>
                    setEditing((prev) => ({
                      ...prev,
                      [review.id]: { ...review, reviewerPhone: event.target.value }
                    }))
                  }
                  className="rounded-lg border border-app-border px-3 py-2 text-sm"
                  placeholder="Reviewer phone"
                />
                <label className="text-sm">
                  Rating
                  <select
                    value={review.rating}
                    onChange={(event) =>
                      setEditing((prev) => ({
                        ...prev,
                        [review.id]: { ...review, rating: Number(event.target.value) }
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-app-border px-3 py-2 text-sm"
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} Star
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={review.isHidden}
                    onChange={(event) =>
                      setEditing((prev) => ({
                        ...prev,
                        [review.id]: { ...review, isHidden: event.target.checked }
                      }))
                    }
                  />
                  Hide from public
                </label>
                <textarea
                  value={review.comment}
                  onChange={(event) =>
                    setEditing((prev) => ({
                      ...prev,
                      [review.id]: { ...review, comment: event.target.value }
                    }))
                  }
                  className="min-h-24 rounded-lg border border-app-border px-3 py-2 text-sm md:col-span-2"
                />
              </div>

              <p className="mt-2 text-xs text-app-muted">
                Book: {review.bookTitle || "Unknown"} ({review.publicCode || "-"}) | Created: {formatDate(review.createdAt)}
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => updateMutation.mutate(review)}
                  className="rounded-lg border border-app-border px-3 py-1.5 text-xs"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const confirmed = await appConfirm("Delete this review?", "Delete Review");
                    if (!confirmed) return;
                    deleteMutation.mutate(review.id);
                  }}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs text-rose-700"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {merged.length > 0 ? <Pagination page={page} pageSize={PAGE_SIZE} total={merged.length} onPageChange={setPage} isBusy={query.isFetching} /> : null}
    </div>
  );
};
