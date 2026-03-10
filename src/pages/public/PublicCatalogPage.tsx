import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";

interface PublicBooksResponse {
  items: Array<{
    id: number;
    publicCode: string;
    title?: string;
    subtitle?: string;
    authors: string[];
    category?: string;
    language?: string;
    room?: string;
    cabinet?: string;
    rack?: string;
    shelf?: string;
    positionNote?: string;
    coverImageKey?: string;
    dateAdded: string;
  }>;
  total: number;
}

interface PublicSummary {
  totalPublicBooks: number;
}

export const PublicCatalogPage = () => {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["public-summary"],
    queryFn: () => apiRequest<PublicSummary>("/api/public/summary")
  });

  const booksQuery = useQuery({
    queryKey: ["public-books", search, location],
    queryFn: () =>
      apiRequest<PublicBooksResponse>("/api/public/books", {
        params: {
          search,
          location,
          limit: 200,
          offset: 0
        }
      })
  });

  if (summaryQuery.isLoading || booksQuery.isLoading) return <LoadingState label="Loading public catalog..." />;
  if (summaryQuery.isError || booksQuery.isError) {
    return <ErrorState message={(summaryQuery.error as Error)?.message || (booksQuery.error as Error)?.message || "Failed to load"} />;
  }

  const books = booksQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-app-border bg-white p-5 shadow-card">
        <h2 className="font-heading text-2xl">Explore the Collection</h2>
        <p className="mt-1 text-sm text-app-muted">
          Public books available: <strong>{summaryQuery.data?.totalPublicBooks ?? 0}</strong>
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, author, code..."
            className="w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Search by shelf / rack / cabinet"
            className="w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
        </div>
      </section>

      {books.length === 0 ? (
        <EmptyState title="No public books found" description="Try another search term or location." />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => {
            const locationText = [book.room, book.cabinet, book.rack, book.shelf, book.positionNote].filter(Boolean).join(" / ");
            return (
              <Link
                key={book.id}
                to={`/book/${book.publicCode}`}
                className="group rounded-2xl border border-app-border bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:border-app-primary"
              >
                <div className="grid grid-cols-[94px_1fr] gap-3">
                  <div className="h-34 w-24 overflow-hidden rounded-xl bg-app-surface">
                    {book.coverImageKey ? (
                      <img
                        src={`/i/${encodeURIComponent(book.coverImageKey)}`}
                        alt={book.title ?? "Book cover"}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="inline-flex rounded-full bg-app-surface px-2 py-0.5 text-[11px] text-app-muted">{book.publicCode}</p>
                    <h3 className="mt-1 font-heading text-base text-app-text">{book.title || "Untitled"}</h3>
                    <p className="mt-0.5 line-clamp-1 text-sm text-app-muted">{book.authors.join(", ") || "Unknown author"}</p>
                    <p className="mt-1 text-xs text-app-muted">{book.category || "Uncategorized"} - {book.language || "Unknown"}</p>
                    <p className="mt-1 text-xs text-app-muted">Shelf: {locationText || "Not specified"}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
};