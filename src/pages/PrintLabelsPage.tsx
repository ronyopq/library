import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LabelPreview } from "@/components/labels/LabelPreview";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest, downloadFile } from "@/lib/api";

export const PrintLabelsPage = () => {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [overrideOptions, setOverrideOptions] = useState<
    Partial<{
      labelIncludeTitle: boolean;
      labelIncludeAuthor: boolean;
      labelIncludeDate: boolean;
      labelIncludeQr: boolean;
      labelColumns: number;
      labelWidthMm: number;
      labelHeightMm: number;
    }>
  >({});

  const booksQuery = useQuery({
    queryKey: ["books", "labels"],
    queryFn: () => apiRequest<{ items: any[] }>("/api/books", { params: { includeArchived: 0, limit: 400, sort: "title" } })
  });

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<{ settings: any }>("/api/settings")
  });

  if (booksQuery.isLoading || settingsQuery.isLoading) return <LoadingState />;
  if (booksQuery.isError || settingsQuery.isError) {
    return <ErrorState message={(booksQuery.error as Error)?.message || (settingsQuery.error as Error)?.message || "Failed"} />;
  }

  const books = booksQuery.data?.items ?? [];
  const settings = settingsQuery.data?.settings;

  const displaySettings = {
    labelIncludeTitle: overrideOptions.labelIncludeTitle ?? settings.labelIncludeTitle,
    labelIncludeAuthor: overrideOptions.labelIncludeAuthor ?? settings.labelIncludeAuthor,
    labelIncludeDate: overrideOptions.labelIncludeDate ?? settings.labelIncludeDate,
    labelIncludeQr: overrideOptions.labelIncludeQr ?? settings.labelIncludeQr,
    labelColumns: overrideOptions.labelColumns ?? settings.labelColumns,
    labelWidthMm: overrideOptions.labelWidthMm ?? settings.labelWidthMm,
    labelHeightMm: overrideOptions.labelHeightMm ?? settings.labelHeightMm
  };

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    if (!keyword) return books;
    return books.filter((book) =>
      [book.title, book.accessionCode, book.publicCode, ...(book.authors ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [books, search]);

  const selectedBooks = books.filter((book) => selectedIds.includes(book.id));

  const toggle = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
        <h2 className="font-heading text-xl">Print Barcodes / Labels</h2>
        <p className="text-sm text-ink-500">????????? ????? ???? ???????????? ?????</p>
      </header>

      <section className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title/accession/author"
            className="rounded-xl border border-brand-200 px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
            Print ({selectedBooks.length})
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadFile("/api/export/books.csv")}
              className="rounded-lg border border-brand-200 px-3 py-2 text-sm"
            >
              Export Books CSV
            </button>
            <button
              type="button"
              onClick={() => downloadFile("/api/export/loans.csv")}
              className="rounded-lg border border-brand-200 px-3 py-2 text-sm"
            >
              Export Loans CSV
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {[
            ["labelIncludeTitle", "Title"],
            ["labelIncludeAuthor", "Author"],
            ["labelIncludeDate", "Date"],
            ["labelIncludeQr", "QR"]
          ].map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean((displaySettings as any)[key])}
                onChange={(event) =>
                  setOverrideOptions((prev) => ({
                    ...prev,
                    [key]: event.target.checked
                  }))
                }
              />
              {label}
            </label>
          ))}

          <label className="inline-flex items-center gap-2">
            Columns
            <input
              type="number"
              min={1}
              max={5}
              value={displaySettings.labelColumns}
              onChange={(event) =>
                setOverrideOptions((prev) => ({
                  ...prev,
                  labelColumns: Number(event.target.value)
                }))
              }
              className="w-14 rounded border border-brand-200 px-2 py-1"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-200 bg-white p-4 shadow-soft print:hidden">
        <h3 className="font-heading text-base">Select Books</h3>
        {filtered.length === 0 ? (
          <EmptyState title="No books" />
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((book) => (
              <li key={book.id} className="rounded-lg border border-brand-100 p-2 text-sm">
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" checked={selectedIds.includes(book.id)} onChange={() => toggle(book.id)} className="mt-1" />
                  <span>
                    <strong>{book.title || "Untitled"}</strong>
                    <br />
                    <span className="text-xs text-ink-500">{book.accessionCode} • {book.authors?.join(", ")}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="label-grid grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${displaySettings.labelColumns}, minmax(0, 1fr))`
        }}
      >
        {selectedBooks.map((book) => (
          <div
            key={book.id}
            className="print:break-inside-avoid"
            style={{ minHeight: `${displaySettings.labelHeightMm}mm`, minWidth: `${displaySettings.labelWidthMm}mm` }}
          >
            <LabelPreview
              book={book}
              libraryName={settings.libraryName}
              publicBaseUrl={settings.publicBaseUrl}
              includeTitle={displaySettings.labelIncludeTitle}
              includeAuthor={displaySettings.labelIncludeAuthor}
              includeDate={displaySettings.labelIncludeDate}
              includeQr={displaySettings.labelIncludeQr}
            />
          </div>
        ))}
      </section>
    </div>
  );
};