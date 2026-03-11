import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookCard } from "@/components/books/BookCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Pagination } from "@/components/common/Pagination";
import { apiRequest } from "@/lib/api";
import { appConfirm } from "@/lib/appDialog";

interface BooksResponse {
  items: any[];
  total: number;
}

export const ArchivedPage = () => {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const queryClient = useQueryClient();

  const booksQuery = useQuery({
    queryKey: ["books", "archived", page],
    queryFn: () =>
      apiRequest<BooksResponse>("/api/books", {
        params: {
          includeArchived: 1,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          sort: "recent"
        }
      }),
    placeholderData: (previousData) => previousData
  });

  const restoreMutation = useMutation({
    mutationFn: (bookId: number) => apiRequest(`/api/books/${bookId}/restore`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (bookId: number) => apiRequest(`/api/books/${bookId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    }
  });

  if (!booksQuery.data && booksQuery.isLoading) return <LoadingState />;
  if (booksQuery.isError) return <ErrorState message={(booksQuery.error as Error).message} retry={() => booksQuery.refetch()} />;

  const archived = (booksQuery.data?.items ?? []).filter((item) => item.isArchived);
  const total = booksQuery.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Archived Books</h2>
        <p className="text-sm text-app-muted">{archived.length} archived records</p>
      </header>

      {archived.length === 0 ? (
        <EmptyState title="Archive is empty" description="Archived books will appear here." />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {archived.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onRestore={(item) => restoreMutation.mutate(item.id)}
              onDelete={async (item) => {
                const confirmed = await appConfirm(
                  `Delete "${item.title || item.accessionCode}" permanently? This cannot be undone.`,
                  "Delete Book"
                );
                if (!confirmed) return;
                deleteMutation.mutate(item.id);
              }}
            />
          ))}
        </section>
      )}
      {total > 0 ? <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} isBusy={booksQuery.isFetching} /> : null}
    </div>
  );
};
