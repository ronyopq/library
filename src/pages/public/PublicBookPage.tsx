import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { resolveCoverImageUrl } from "@/lib/cover";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { formatDate } from "@/lib/date";
import { appAlert } from "@/lib/appDialog";

interface PublicBookResponse {
  canViewPrivateContact: boolean;
  book: {
    publicCode: string;
    accessionCode: string;
    title?: string;
    subtitle?: string;
    summary?: string;
    publicNotes?: string;
    dateAdded: string;
    coverImageKey?: string;
    languageName?: string;
    categoryName?: string;
    publisherName?: string;
    authors: string[];
    room?: string;
    cabinet?: string;
    rack?: string;
    shelf?: string;
    positionNote?: string;
    copyCount: number;
    availableCopyCount: number;
    borrowedCopyCount: number;
    lostCopyCount: number;
    copies: Array<{
      id: number;
      copyCode: string;
      status: string;
    }>;
    activeLoans: Array<{
      copyCode: string;
      borrowerName?: string;
      borrowerPhone?: string;
      borrowerPhoneMasked?: string;
      borrowedAt?: string;
      expectedReturnAt?: string;
    }>;
  };
  averageRating: number;
  ratingCount: number;
  reviews: Array<{
    id: number;
    reviewerName: string;
    reviewerPhone?: string;
    reviewerPhoneMasked?: string;
    rating: number;
    comment: string;
    createdAt: string;
  }>;
}

export const PublicBookPage = () => {
  const params = useParams();
  const shortCode = params.shortCode ?? "";
  const queryClient = useQueryClient();
  const [reviewForm, setReviewForm] = useState({
    reviewerName: "",
    reviewerPhone: "",
    rating: 5,
    comment: ""
  });
  const [requestForm, setRequestForm] = useState({
    requesterName: "",
    requesterOrganization: "",
    requesterDesignation: "",
    requesterAddress: "",
    requesterPhone: "",
    requesterEmail: "",
    borrowedAt: "",
    expectedReturnAt: "",
    requestedCopyId: "",
    note: ""
  });
  const [requestMessage, setRequestMessage] = useState("");

  const query = useQuery({
    queryKey: ["public-book", shortCode],
    queryFn: () => apiRequest<PublicBookResponse>(`/api/public/books/${shortCode}`),
    enabled: shortCode.length > 0
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/public/books/${shortCode}/reviews`, {
        method: "POST",
        body: JSON.stringify(reviewForm)
      }),
    onSuccess: () => {
      setReviewForm({
        reviewerName: "",
        reviewerPhone: "",
        rating: 5,
        comment: ""
      });
      queryClient.invalidateQueries({ queryKey: ["public-book", shortCode] });
    },
    onError: (error) => {
      appAlert((error as Error).message);
    }
  });

  const requestMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/public/books/${shortCode}/borrow-requests`, {
        method: "POST",
        body: JSON.stringify({
          requesterName: requestForm.requesterName,
          requesterOrganization: requestForm.requesterOrganization || undefined,
          requesterDesignation: requestForm.requesterDesignation || undefined,
          requesterAddress: requestForm.requesterAddress || undefined,
          requesterPhone: requestForm.requesterPhone,
          requesterEmail: requestForm.requesterEmail || undefined,
          borrowedAt: requestForm.borrowedAt || undefined,
          expectedReturnAt: requestForm.expectedReturnAt || undefined,
          requestedCopyId: requestForm.requestedCopyId ? Number(requestForm.requestedCopyId) : undefined,
          note: requestForm.note || undefined
        })
      }),
    onSuccess: () => {
      setRequestForm({
        requesterName: "",
        requesterOrganization: "",
        requesterDesignation: "",
        requesterAddress: "",
        requesterPhone: "",
        requesterEmail: "",
        borrowedAt: "",
        expectedReturnAt: "",
        requestedCopyId: "",
        note: ""
      });
      setRequestMessage("Borrow request submitted. Admin will review and approve.");
    },
    onError: (error) => {
      setRequestMessage((error as Error).message);
    }
  });

  if (query.isLoading) return <LoadingState label="Loading public book details..." />;
  if (query.isError || !query.data) return <ErrorState message={(query.error as Error)?.message || "Book not found"} />;

  const { book } = query.data;
  const location = [book.room, book.cabinet, book.rack, book.shelf, book.positionNote].filter(Boolean).join(" / ");
  const coverUrl = resolveCoverImageUrl(book.coverImageKey);

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex rounded-lg border border-app-border px-3 py-1.5 text-sm hover:bg-app-surface">
        Back to catalog
      </Link>

      <article className="grid gap-4 rounded-3xl border border-app-border bg-white p-5 shadow-card md:grid-cols-[220px_1fr]">
        <div className="overflow-hidden rounded-2xl bg-app-surface">
          {coverUrl ? (
            <img src={coverUrl} alt={book.title ?? "Book cover"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-72 items-center justify-center text-sm text-app-muted">No cover image</div>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-app-muted">Public Book Page</p>
          <h2 className="mt-2 font-heading text-3xl text-app-text">{book.title || "Untitled"}</h2>
          {book.subtitle ? <p className="mt-1 text-app-muted">{book.subtitle}</p> : null}

          <div className="mt-4 grid gap-2 text-sm text-app-text md:grid-cols-2">
            <p>
              <strong>Author:</strong> {book.authors.join(", ") || "Unknown"}
            </p>
            <p>
              <strong>Publisher:</strong> {book.publisherName || "Unknown"}
            </p>
            <p>
              <strong>Category:</strong> {book.categoryName || "Uncategorized"}
            </p>
            <p>
              <strong>Language:</strong> {book.languageName || "Unknown"}
            </p>
            <p>
              <strong>Shelf:</strong> {location || "Not specified"}
            </p>
            <p>
              <strong>Code:</strong> {book.publicCode}
            </p>
            <p>
              <strong>Copies:</strong> {book.copyCount} total ({book.availableCopyCount} available, {book.borrowedCopyCount} borrowed)
            </p>
            <p>
              <strong>Average Rating:</strong> {query.data.averageRating.toFixed(2)} / 5 ({query.data.ratingCount} ratings)
            </p>
          </div>

          {book.activeLoans.length > 0 ? (
            <div className="mt-4 rounded-xl border border-app-border bg-app-surface p-3">
              <h3 className="font-heading text-base">Currently Borrowed By</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {book.activeLoans.map((loan) => (
                  <li key={loan.copyCode} className="rounded-lg border border-app-border bg-white p-2">
                    <p>
                      <strong>{loan.copyCode}</strong> - {loan.borrowerName || "Borrower"}
                      {query.data.canViewPrivateContact
                        ? loan.borrowerPhone
                          ? ` (${loan.borrowerPhone})`
                          : ""
                        : loan.borrowerPhoneMasked
                          ? ` (${loan.borrowerPhoneMasked})`
                          : ""}
                    </p>
                    <p className="text-xs text-app-muted">
                      Borrowed: {loan.borrowedAt ? formatDate(loan.borrowedAt) : "-"} | Expected Return:{" "}
                      {loan.expectedReturnAt ? formatDate(loan.expectedReturnAt) : "-"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {book.summary ? (
            <div className="mt-4 rounded-xl border border-app-border bg-app-surface p-3">
              <h3 className="font-heading text-base">Summary</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-app-muted">{book.summary}</p>
            </div>
          ) : null}

          {book.publicNotes ? (
            <div className="mt-3 rounded-xl border border-app-border bg-app-surface p-3">
              <h3 className="font-heading text-base">Public Notes</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-app-muted">{book.publicNotes}</p>
            </div>
          ) : null}
        </div>
      </article>

      <section className="rounded-3xl border border-app-border bg-white p-5 shadow-card">
        <h3 className="font-heading text-xl">Request Borrow</h3>
        <p className="mt-1 text-sm text-app-muted">Submit a borrow request. Admin or librarian will approve it.</p>

        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            requestMutation.mutate();
          }}
        >
          <input
            value={requestForm.requesterName}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, requesterName: event.target.value }))}
            placeholder="Your name"
            required
            className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          <input
            value={requestForm.requesterPhone}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, requesterPhone: event.target.value }))}
            placeholder="Mobile number"
            required
            className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          <input
            value={requestForm.requesterOrganization}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, requesterOrganization: event.target.value }))}
            placeholder="Organization (optional)"
            className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          <input
            value={requestForm.requesterDesignation}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, requesterDesignation: event.target.value }))}
            placeholder="Designation (optional)"
            className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          <input
            value={requestForm.requesterEmail}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, requesterEmail: event.target.value }))}
            placeholder="Email (optional)"
            className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={requestForm.borrowedAt}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, borrowedAt: event.target.value }))}
            className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={requestForm.expectedReturnAt}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, expectedReturnAt: event.target.value }))}
            className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />

          <label className="text-sm">
            Preferred Copy (optional)
            <select
              value={requestForm.requestedCopyId}
              onChange={(event) => setRequestForm((prev) => ({ ...prev, requestedCopyId: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
            >
              <option value="">Any available copy</option>
              {book.copies.map((copy) => (
                <option key={copy.id} value={copy.id}>
                  {copy.copyCode} ({copy.status})
                </option>
              ))}
            </select>
          </label>

          <div />

          <textarea
            value={requestForm.requesterAddress}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, requesterAddress: event.target.value }))}
            placeholder="Address (optional)"
            className="min-h-20 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm md:col-span-2"
          />
          <textarea
            value={requestForm.note}
            onChange={(event) => setRequestForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="Note (optional)"
            className="min-h-24 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm md:col-span-2"
          />
          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <p className="text-xs text-app-muted">{requestMessage}</p>
            <button
              type="submit"
              disabled={requestMutation.isPending}
              className="rounded-xl bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-app-primary-strong disabled:opacity-60"
            >
              {requestMutation.isPending ? "Submitting..." : "Submit Borrow Request"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-app-border bg-white p-5 shadow-card">
        <h3 className="font-heading text-xl">Ratings and Comments</h3>
        <p className="mt-1 text-sm text-app-muted">Share your reading feedback with your name and phone number.</p>

        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            reviewMutation.mutate();
          }}
        >
          <input
            value={reviewForm.reviewerName}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, reviewerName: event.target.value }))}
            placeholder="Your name"
            required
            className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          <input
            value={reviewForm.reviewerPhone}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, reviewerPhone: event.target.value }))}
            placeholder="Mobile number"
            required
            className="rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          <label className="text-sm">
            Rating
            <select
              value={reviewForm.rating}
              onChange={(event) => setReviewForm((prev) => ({ ...prev, rating: Number(event.target.value) }))}
              className="mt-1 w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} Star
                </option>
              ))}
            </select>
          </label>
          <div />
          <textarea
            value={reviewForm.comment}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
            placeholder="Write your comment..."
            required
            className="min-h-24 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm md:col-span-2"
          />
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={reviewMutation.isPending}
              className="rounded-xl bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-app-primary-strong disabled:opacity-60"
            >
              {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>

        <div className="mt-5 space-y-3">
          {query.data.reviews.length === 0 ? (
            <p className="text-sm text-app-muted">No reviews yet.</p>
          ) : (
            query.data.reviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-app-border bg-app-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {review.reviewerName} (
                    {query.data.canViewPrivateContact ? review.reviewerPhone || review.reviewerPhoneMasked : review.reviewerPhoneMasked}
                    )
                  </p>
                  <p className="text-sm text-app-muted">
                    {"\u2605".repeat(review.rating)}
                    {"\u2606".repeat(Math.max(0, 5 - review.rating))}
                  </p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-app-text">{review.comment}</p>
                <p className="mt-1 text-xs text-app-muted">{new Date(review.createdAt).toLocaleString()}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
