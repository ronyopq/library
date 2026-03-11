import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BarcodeSvg } from "@/components/common/BarcodeSvg";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { resolveCoverImageUrl } from "@/lib/cover";
import { formatDate } from "@/lib/date";

interface BookDetails {
  id: number;
  accessionCode: string;
  publicCode: string;
  title?: string;
  categoryName?: string;
  languageName?: string;
  publisherName?: string;
  edition?: string;
  isbn10?: string;
  isbn13?: string;
  publicationYear?: number;
  status: string;
  dateAdded: string;
  room?: string;
  cabinet?: string;
  rack?: string;
  shelf?: string;
  positionNote?: string;
  summary?: string;
  publicNotes?: string;
  personalNotes?: string;
  coverImageKey?: string;
  isArchived: boolean;
  contributors?: Array<{ role: string; name: string }>;
  copyCount?: number;
  availableCopyCount?: number;
  borrowedCopyCount?: number;
  lostCopyCount?: number;
  copies?: Array<{
    id: number;
    copyCode: string;
    barcodeValue: string;
    status: string;
    borrowerName?: string;
    borrowedAt?: string;
    expectedReturnAt?: string;
  }>;
  loanHistory?: Array<{
    id: number;
    status: string;
    borrowerName: string;
    borrowerDesignation?: string;
    borrowerPhone?: string;
    borrowedAt: string;
    expectedReturnAt?: string;
    returnedAt?: string;
    note?: string;
    copyCode?: string;
  }>;
}

const statusBadgeClass = (status?: string) =>
  status === "borrowed"
    ? "bg-amber-100 text-amber-800"
    : status === "lost"
      ? "bg-rose-100 text-rose-700"
      : "bg-emerald-100 text-emerald-700";

const DAY_MS = 24 * 60 * 60 * 1000;
const getReadingDays = (borrowedAt?: string, returnedAt?: string): number | null => {
  if (!borrowedAt) return null;
  const start = new Date(borrowedAt).getTime();
  const end = returnedAt ? new Date(returnedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.max(1, Math.ceil((end - start) / DAY_MS));
};

export const BookDetailsPage = () => {
  const params = useParams();
  const bookId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["book", bookId],
    queryFn: () => apiRequest<BookDetails>(`/api/books/${bookId}`),
    enabled: Number.isInteger(bookId)
  });

  const archiveMutation = useMutation({
    mutationFn: () => apiRequest(`/api/books/${bookId}/archive`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/admin/library");
    }
  });

  const restoreMutation = useMutation({
    mutationFn: () => apiRequest(`/api/books/${bookId}/restore`, { method: "POST" }),
    onSuccess: () => {
      query.refetch();
      queryClient.invalidateQueries({ queryKey: ["books"] });
    }
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState message={(query.error as Error).message || "Book not found"} />;

  const book = query.data;
  const coverUrl = resolveCoverImageUrl(book.coverImageKey);
  const qrValue = `${window.location.origin}/b/${book.publicCode}`;
  const authors = book.contributors?.filter((item) => item.role === "author").map((item) => item.name).join(", ");
  const copies = book.copies ?? [];
  const loanHistory = book.loanHistory ?? [];
  const primaryCopyCode = copies[0]?.copyCode ?? `${book.accessionCode}-C01`;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl text-app-text">{book.title || "Untitled"}</h2>
            <p className="text-sm text-app-muted">{authors || "No author"}</p>
            <p className="mt-1 text-xs text-app-muted">
              {book.accessionCode} - {book.publicCode}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/admin/books/${bookId}/edit`} className="rounded-lg border border-app-border px-3 py-2 text-sm">
              Edit
            </Link>
            {!book.isArchived ? (
              <button
                type="button"
                onClick={() => archiveMutation.mutate()}
                className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700"
              >
                Archive
              </button>
            ) : (
              <button
                type="button"
                onClick={() => restoreMutation.mutate()}
                className="rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-700"
              >
                Restore
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
          {coverUrl ? (
            <img src={coverUrl} alt={book.title ?? "cover"} className="h-72 w-full rounded-lg object-cover" />
          ) : (
            <div className="flex h-72 items-center justify-center rounded-lg bg-app-surface text-sm text-app-muted">No Cover</div>
          )}
          <div className="mt-4 rounded-xl border border-app-border p-2">
            <div className="overflow-hidden rounded">
              <BarcodeSvg value={primaryCopyCode} height={46} width={1.25} />
            </div>
            <p className="mt-1 text-center text-xs">{primaryCopyCode}</p>
          </div>
          <div className="mt-3 flex justify-center">
            <QRCodeSVG value={qrValue} size={120} />
          </div>
        </aside>

        <article className="space-y-4 rounded-2xl border border-app-border bg-white p-4 shadow-card">
          <div className="grid gap-3 md:grid-cols-2">
            <p>
              <strong>Category:</strong> {book.categoryName || "-"}
            </p>
            <p>
              <strong>Language:</strong> {book.languageName || "-"}
            </p>
            <p>
              <strong>Publisher:</strong> {book.publisherName || "-"}
            </p>
            <p>
              <strong>Edition:</strong> {book.edition || "-"}
            </p>
            <p>
              <strong>ISBN-10:</strong> {book.isbn10 || "-"}
            </p>
            <p>
              <strong>ISBN-13:</strong> {book.isbn13 || "-"}
            </p>
            <p>
              <strong>Published:</strong> {book.publicationYear || "-"}
            </p>
            <p>
              <strong>Status:</strong> {book.status || "-"}
            </p>
            <p>
              <strong>Added:</strong> {formatDate(book.dateAdded)}
            </p>
            <p>
              <strong>Location:</strong>{" "}
              {[book.room, book.cabinet, book.rack, book.shelf, book.positionNote].filter(Boolean).join(" / ") || "-"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-app-border bg-app-surface p-2 text-center">
              <p className="text-[11px] text-app-muted">Total Copies</p>
              <p className="font-heading text-xl">{book.copyCount ?? copies.length}</p>
            </div>
            <div className="rounded-xl border border-app-border bg-app-surface p-2 text-center">
              <p className="text-[11px] text-app-muted">Available</p>
              <p className="font-heading text-xl text-emerald-700">{book.availableCopyCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-app-border bg-app-surface p-2 text-center">
              <p className="text-[11px] text-app-muted">Borrowed</p>
              <p className="font-heading text-xl text-amber-700">{book.borrowedCopyCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-app-border bg-app-surface p-2 text-center">
              <p className="text-[11px] text-app-muted">Lost</p>
              <p className="font-heading text-xl text-rose-700">{book.lostCopyCount ?? 0}</p>
            </div>
          </div>

          <div>
            <h3 className="font-heading text-base">Summary</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-app-muted">{book.summary || "-"}</p>
          </div>

          <div>
            <h3 className="font-heading text-base">Public Notes</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-app-muted">{book.publicNotes || "-"}</p>
          </div>

          <div>
            <h3 className="font-heading text-base">Private Notes</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-app-muted">{book.personalNotes || "-"}</p>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Copy-wise Lending and Barcode</h3>
        {copies.length === 0 ? (
          <p className="mt-2 text-sm text-app-muted">No copy records found.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {copies.map((copy) => (
              <article key={copy.id} className="rounded-xl border border-app-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{copy.copyCode}</p>
                    <p className="text-xs text-app-muted">
                      Borrowed by: {copy.borrowerName || "Not borrowed"}
                      {copy.borrowedAt ? ` - ${formatDate(copy.borrowedAt)}` : ""}
                      {copy.expectedReturnAt ? ` (Due ${formatDate(copy.expectedReturnAt)})` : ""}
                    </p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] ${statusBadgeClass(copy.status)}`}>
                      {copy.status}
                    </span>
                  </div>
                  <div className="w-[220px] max-w-full overflow-hidden rounded border border-app-border p-2">
                    <BarcodeSvg value={copy.barcodeValue || copy.copyCode} height={38} width={1.1} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Borrow Timeline (All Previous Records)</h3>
        {loanHistory.length === 0 ? (
          <p className="mt-2 text-sm text-app-muted">No borrow records for this book yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {loanHistory.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-app-border p-3">
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <p>
                    <strong>Copy No:</strong> {entry.copyCode || "-"}
                  </p>
                  <p>
                    <strong>Borrower:</strong> {entry.borrowerName}
                  </p>
                  <p>
                    <strong>Designation:</strong> {entry.borrowerDesignation || "-"}
                  </p>
                  <p>
                    <strong>Mobile:</strong> {entry.borrowerPhone || "-"}
                  </p>
                  <p>
                    <strong>Borrow Date:</strong> {formatDate(entry.borrowedAt)}
                  </p>
                  <p>
                    <strong>Return Date:</strong> {formatDate(entry.returnedAt)}
                  </p>
                  <p>
                    <strong>Total Reading Day:</strong> {getReadingDays(entry.borrowedAt, entry.returnedAt) ?? "-"}
                  </p>
                  <p>
                    <strong>Status:</strong> {entry.status}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-app-muted">
                  <MessageSquareText className="h-4 w-4" />
                  <span>{entry.note || "No comment"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
