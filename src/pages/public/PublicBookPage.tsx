import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";

interface PublicBookResponse {
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
  };
}

export const PublicBookPage = () => {
  const params = useParams();
  const shortCode = params.shortCode ?? "";

  const query = useQuery({
    queryKey: ["public-book", shortCode],
    queryFn: () => apiRequest<PublicBookResponse>(`/api/public/books/${shortCode}`),
    enabled: shortCode.length > 0
  });

  if (query.isLoading) return <LoadingState label="Loading public book details..." />;
  if (query.isError || !query.data) return <ErrorState message={(query.error as Error)?.message || "Book not found"} />;

  const { book } = query.data;
  const location = [book.room, book.cabinet, book.rack, book.shelf, book.positionNote].filter(Boolean).join(" / ");

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex rounded-lg border border-app-border px-3 py-1.5 text-sm hover:bg-app-surface">
        Back to catalog
      </Link>

      <article className="grid gap-4 rounded-3xl border border-app-border bg-white p-5 shadow-card md:grid-cols-[220px_1fr]">
        <div className="overflow-hidden rounded-2xl bg-app-surface">
          {book.coverImageKey ? (
            <img src={`/i/${encodeURIComponent(book.coverImageKey)}`} alt={book.title ?? "Book cover"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-72 items-center justify-center text-sm text-app-muted">No cover image</div>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-app-muted">Public Book Page</p>
          <h2 className="mt-2 font-heading text-3xl text-app-text">{book.title || "Untitled"}</h2>
          {book.subtitle ? <p className="mt-1 text-app-muted">{book.subtitle}</p> : null}

          <div className="mt-4 grid gap-2 text-sm text-app-text md:grid-cols-2">
            <p><strong>Author:</strong> {book.authors.join(", ") || "Unknown"}</p>
            <p><strong>Publisher:</strong> {book.publisherName || "Unknown"}</p>
            <p><strong>Category:</strong> {book.categoryName || "Uncategorized"}</p>
            <p><strong>Language:</strong> {book.languageName || "Unknown"}</p>
            <p><strong>Shelf:</strong> {location || "Not specified"}</p>
            <p><strong>Code:</strong> {book.publicCode}</p>
          </div>

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
    </div>
  );
};