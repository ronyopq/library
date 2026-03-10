import Barcode from "react-barcode";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/date";

export const BookDetailsPage = () => {
  const params = useParams();
  const bookId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["book", bookId],
    queryFn: () => apiRequest<any>(`/api/books/${bookId}`),
    enabled: Number.isInteger(bookId)
  });

  const archiveMutation = useMutation({
    mutationFn: () => apiRequest(`/api/books/${bookId}/archive`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/library");
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
  const qrValue = `${window.location.origin}/b/${book.publicCode}`;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl text-ink-900">{book.title || "Untitled"}</h2>
            <p className="text-sm text-ink-500">{book.contributors?.filter((item: any) => item.role === "author").map((item: any) => item.name).join(", ") || "No author"}</p>
            <p className="mt-1 text-xs text-ink-400">{book.accessionCode} • {book.publicCode}</p>
          </div>
          <div className="flex gap-2">
            <Link to={`/books/${bookId}/edit`} className="rounded-lg border border-brand-200 px-3 py-2 text-sm">
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
        <aside className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
          {book.coverImageKey ? (
            <img
              src={`/i/${encodeURIComponent(book.coverImageKey)}`}
              alt={book.title ?? "cover"}
              className="h-72 w-full rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-72 items-center justify-center rounded-lg bg-brand-50 text-sm text-ink-500">No Cover</div>
          )}
          <div className="mt-4 rounded-xl border border-brand-100 p-2">
            <Barcode value={book.accessionCode} height={46} width={1.1} displayValue={false} background="transparent" margin={0} />
            <p className="mt-1 text-center text-xs">{book.accessionCode}</p>
          </div>
          <div className="mt-3 flex justify-center">
            <QRCodeSVG value={qrValue} size={120} />
          </div>
        </aside>

        <article className="space-y-4 rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
          <div className="grid gap-3 md:grid-cols-2">
            <p><strong>Category:</strong> {book.categoryName || "-"}</p>
            <p><strong>Language:</strong> {book.languageName || "-"}</p>
            <p><strong>Publisher:</strong> {book.publisherName || "-"}</p>
            <p><strong>Edition:</strong> {book.edition || "-"}</p>
            <p><strong>ISBN-10:</strong> {book.isbn10 || "-"}</p>
            <p><strong>ISBN-13:</strong> {book.isbn13 || "-"}</p>
            <p><strong>Published:</strong> {book.publicationYear || "-"}</p>
            <p><strong>Status:</strong> {book.status || "-"}</p>
            <p><strong>Added:</strong> {formatDate(book.dateAdded)}</p>
            <p><strong>Location:</strong> {[book.room, book.cabinet, book.rack, book.shelf, book.positionNote].filter(Boolean).join(" / ") || "-"}</p>
          </div>

          <div>
            <h3 className="font-heading text-base">Summary</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{book.summary || "-"}</p>
          </div>

          <div>
            <h3 className="font-heading text-base">Public Notes</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{book.publicNotes || "-"}</p>
          </div>

          <div>
            <h3 className="font-heading text-base">Private Notes</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{book.personalNotes || "-"}</p>
          </div>
        </article>
      </section>
    </div>
  );
};