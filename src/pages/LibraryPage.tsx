import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LibraryOptions } from "@shared/types";
import { BookCard } from "@/components/books/BookCard";
import { BookFilters, type LibraryFilters } from "@/components/books/BookFilters";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
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
  const debounced = useDebounce(filters, 280);
  const queryClient = useQueryClient();

  const optionsQuery = useQuery({
    queryKey: ["library-options"],
    queryFn: () => apiRequest<LibraryOptions>("/api/options")
  });

  const booksQuery = useQuery({
    queryKey: ["books", debounced],
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
          limit: 120,
          offset: 0
        }
      })
  });

  const archiveMutation = useMutation({
    mutationFn: (bookId: number) =>
      apiRequest<{ ok: boolean }>(`/api/books/${bookId}/archive`, {
        method: "POST"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const restoreMutation = useMutation({
    mutationFn: (bookId: number) =>
      apiRequest<{ ok: boolean }>(`/api/books/${bookId}/restore`, {
        method: "POST"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const items = booksQuery.data?.items ?? [];

  const subtitle = useMemo(() => {
    const total = booksQuery.data?.total ?? 0;
    return `${total} ?? ?? ????? ????`;
  }, [booksQuery.data?.total]);

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
        <h2 className="font-heading text-xl text-ink-900">Library</h2>
        <p className="text-sm text-ink-500">{subtitle}</p>
      </header>

      <BookFilters filters={filters} onChange={setFilters} options={optionsQuery.data} />

      {booksQuery.isLoading ? <LoadingState /> : null}
      {booksQuery.isError ? <ErrorState message={(booksQuery.error as Error).message} retry={() => booksQuery.refetch()} /> : null}

      {!booksQuery.isLoading && !booksQuery.isError && items.length === 0 ? (
        <EmptyState title="???? ?? ????? ?????" description="??????? ???????? ???? ?? ???? ?? ????? ????" />
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
    </div>
  );
};