import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LibraryOptions } from "@shared/types";
import { BookCard } from "@/components/books/BookCard";
import { BookFilters, type LibraryFilters } from "@/components/books/BookFilters";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Pagination } from "@/components/common/Pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { apiRequest } from "@/lib/api";

const defaultFilters: LibraryFilters = {
  search: "",
  category: "",
  author: "",
  language: "",
  status: "",
  location: "",
  sort: "recent"
};

interface BooksResponse {
  items: any[];
  total: number;
}

export const LibraryPage = () => {
  const [filters, setFilters] = useState<LibraryFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const debounced = useDebounce(filters, 280);
  const queryClient = useQueryClient();

  useEffect(() => {
    setPage(1);
  }, [debounced.search, debounced.category, debounced.author, debounced.language, debounced.status, debounced.location, debounced.sort]);

  const optionsQuery = useQuery({
    queryKey: ["library-options"],
    queryFn: () => apiRequest<LibraryOptions>("/api/options")
  });

  const booksQuery = useQuery({
    queryKey: ["books", debounced, page],
    queryFn: () =>
      apiRequest<BooksResponse>("/api/books", {
        params: {
          search: debounced.search,
          category: debounced.category,
          author: debounced.author,
          language: debounced.language,
          status: debounced.status,
          location: debounced.location,
          sort: debounced.sort,
          includeArchived: 0,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE
        }
      }),
    placeholderData: (previousData) => previousData
  });

  const archiveMutation = useMutation({
    mutationFn: (bookId: number) => apiRequest<{ ok: boolean }>(`/api/books/${bookId}/archive`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const restoreMutation = useMutation({
    mutationFn: (bookId: number) => apiRequest<{ ok: boolean }>(`/api/books/${bookId}/restore`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const items = booksQuery.data?.items ?? [];
  const total = booksQuery.data?.total ?? 0;

  const subtitle = useMemo(() => {
    const total = booksQuery.data?.total ?? 0;
    return `${total} books found`;
  }, [booksQuery.data?.total]);

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl text-app-text">Library Inventory</h2>
        <p className="text-sm text-app-muted">{subtitle}</p>
      </header>

      <BookFilters filters={filters} onChange={setFilters} options={optionsQuery.data} />

      {!booksQuery.data && booksQuery.isLoading ? <LoadingState /> : null}
      {booksQuery.isError ? <ErrorState message={(booksQuery.error as Error).message} retry={() => booksQuery.refetch()} /> : null}
      {booksQuery.isFetching && booksQuery.data ? <p className="text-sm text-app-muted">Updating results...</p> : null}

      {!booksQuery.isLoading && !booksQuery.isError && items.length === 0 ? (
        <EmptyState title="No books found" description="Change filters or add a new book." />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onArchive={(item) => archiveMutation.mutate(item.id)}
            onRestore={(item) => restoreMutation.mutate(item.id)}
          />
        ))}
      </section>
      {total > 0 ? <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} isBusy={booksQuery.isFetching} /> : null}
    </div>
  );
};
