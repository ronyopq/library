import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { BookCard } from "@/components/books/BookCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";

interface BooksResponse {
  items: any[];
  total: number;
}

export const ArchivedPage = () => {
  const queryClient = useQueryClient();

  const booksQuery = useQuery({
    queryKey: ["books", "archived"],
    queryFn: () =>
      apiRequest<BooksResponse>("/api/books", {
        params: {
          includeArchived: 1,
          limit: 200,
          offset: 0,
          sort: "recent"
        }
      })
  });

  const restoreMutation = useMutation({
    mutationFn: (bookId: number) => apiRequest(`/api/books/${bookId}/restore`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  if (booksQuery.isLoading) return <LoadingState />;
  if (booksQuery.isError) return <ErrorState message={(booksQuery.error as Error).message} retry={() => booksQuery.refetch()} />;

  const archived = (booksQuery.data?.items ?? []).filter((item) => item.isArchived);

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
        <h2 className="font-heading text-xl">Archived Books</h2>
        <p className="text-sm text-ink-500">{archived.length} ?? ?????????? ??</p>
      </header>

      {archived.length === 0 ? (
        <EmptyState title="??????? ????" description="?? ?? ??????? ?????, ????? ???? ????" />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {archived.map((book) => (
            <BookCard key={book.id} book={book} onRestore={(item) => restoreMutation.mutate(item.id)} />
          ))}
        </section>
      )}
    </div>
  );
};