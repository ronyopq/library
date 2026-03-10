import type { BookListItem } from "@shared/types";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/date";

interface BookCardProps {
  book: BookListItem;
  onArchive?: (book: BookListItem) => void;
  onRestore?: (book: BookListItem) => void;
}

export const BookCard = ({ book, onArchive, onRestore }: BookCardProps) => {
  return (
    <article className="group overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300">
      <div className="grid grid-cols-[96px_1fr] gap-3 p-3">
        <div className="h-36 w-24 overflow-hidden rounded-xl bg-brand-100">
          {book.coverImageKey ? (
            <img src={`/i/${encodeURIComponent(book.coverImageKey)}`} alt={book.title ?? "Book cover"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-500">No Cover</div>
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
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700">{book.publicCode}</span>
          </div>

          <h3 className="line-clamp-2 font-heading text-base text-ink-900">{book.title || "??????? ???"}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-ink-600">{book.authors.join(", ") || "???? ???"}</p>

          <div className="mt-3 space-y-1 text-xs text-ink-500">
            <p>{book.category || "????????? ???"}</p>
            <p>{book.language || "???? ???"}</p>
            <p>
              {book.room || ""} {book.cabinet ? `/ ${book.cabinet}` : ""} {book.rack ? `/ ${book.rack}` : ""}{" "}
              {book.shelf ? `/ ${book.shelf}` : ""}
            </p>
            <p>Added: {formatDate(book.dateAdded)}</p>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-brand-100 px-3 py-3">
        <Link
          to={`/books/${book.id}`}
          className="rounded-lg border border-brand-200 px-3 py-1 text-xs text-brand-700 hover:bg-brand-50"
        >
          View
        </Link>
        <Link
          to={`/books/${book.id}/edit`}
          className="rounded-lg border border-brand-200 px-3 py-1 text-xs text-brand-700 hover:bg-brand-50"
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
          <button
            type="button"
            onClick={() => onRestore?.(book)}
            className="rounded-lg border border-emerald-200 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
          >
            Restore
          </button>
        )}
      </footer>
    </article>
  );
};