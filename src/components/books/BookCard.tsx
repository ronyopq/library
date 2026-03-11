import type { BookListItem } from "@shared/types";
import { Link } from "react-router-dom";
import { resolveCoverImageUrl } from "@/lib/cover";
import { formatDate } from "@/lib/date";

interface BookCardProps {
  book: BookListItem;
  onArchive?: (book: BookListItem) => void;
  onRestore?: (book: BookListItem) => void;
  onDelete?: (book: BookListItem) => void;
}

export const BookCard = ({ book, onArchive, onRestore, onDelete }: BookCardProps) => {
  const coverUrl = resolveCoverImageUrl(book.coverImageKey);

  return (
    <article className="group overflow-hidden rounded-2xl border border-app-border bg-white shadow-card transition hover:-translate-y-0.5 hover:border-app-primary">
      <div className="grid grid-cols-[96px_1fr] gap-3 p-3">
        <div className="h-36 w-24 overflow-hidden rounded-xl bg-app-surface">
          {coverUrl ? (
            <img src={coverUrl} alt={book.title ?? "Book cover"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-app-muted">No Cover</div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                book.status === "borrowed"
                  ? "bg-amber-100 text-amber-800"
                  : book.status === "lost"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {book.status}
            </span>
            <span className="rounded-full bg-app-surface px-2 py-0.5 text-[11px] text-app-muted">{book.publicCode}</span>
          </div>

          <h3 className="line-clamp-2 font-heading text-base text-app-text">{book.title || "Untitled"}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-app-muted">{book.authors.join(", ") || "Unknown author"}</p>

          <div className="mt-3 space-y-1 text-xs text-app-muted">
            <p>{book.category || "No category"}</p>
            <p>{book.language || "No language"}</p>
            <p>
              {book.room || ""} {book.cabinet ? `/ ${book.cabinet}` : ""} {book.rack ? `/ ${book.rack}` : ""}{" "}
              {book.shelf ? `/ ${book.shelf}` : ""}
            </p>
            <p>
              Copies: {book.copyCount} ({book.availableCopyCount} available, {book.borrowedCopyCount} borrowed)
            </p>
            <p>Added: {formatDate(book.dateAdded)}</p>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-app-border px-3 py-3">
        <Link
          to={`/admin/loans?bookId=${book.id}`}
          className="rounded-lg bg-app-primary px-3 py-1 text-xs text-white hover:bg-app-primary-strong"
        >
          Borrow
        </Link>
        <Link
          to={`/admin/books/${book.id}`}
          className="rounded-lg border border-app-border px-3 py-1 text-xs text-app-text hover:bg-app-surface"
        >
          View
        </Link>
        <Link
          to={`/admin/books/${book.id}/edit`}
          className="rounded-lg border border-app-border px-3 py-1 text-xs text-app-text hover:bg-app-surface"
        >
          Edit
        </Link>
        {!book.isArchived ? (
          <button
            type="button"
            onClick={() => onArchive?.(book)}
            className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50"
          >
            Archive
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onRestore?.(book)}
              className="rounded-lg border border-emerald-200 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(book)}
              className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50"
            >
              Delete
            </button>
          </>
        )}
      </footer>
    </article>
  );
};
