import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { BookForm } from "@/components/books/BookForm";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { getDraftKey } from "@/lib/draftStore";

export const BookFormPage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const bookId = params.id ? Number(params.id) : undefined;
  const isEdit = Number.isInteger(bookId);

  const query = useQuery({
    queryKey: ["book", bookId],
    queryFn: () => apiRequest(`/api/books/${bookId}`),
    enabled: Boolean(isEdit)
  });

  if (isEdit && query.isLoading) return <LoadingState />;
  if (isEdit && query.isError) return <ErrorState message={(query.error as Error).message} retry={() => query.refetch()} />;

  const initialData = isEdit ? query.data : undefined;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
        <h2 className="font-heading text-xl">{isEdit ? "Edit Book" : "Add New Book"}</h2>
        <p className="text-sm text-ink-500">ISBN lookup, OCR fallback ??? manual entry ???????</p>
      </header>

      <BookForm
        bookId={bookId}
        initialData={initialData}
        draftKey={getDraftKey(bookId)}
        onSaved={(id) => navigate(`/books/${id}`)}
      />
    </div>
  );
};