import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LabelPreview, type LabelItem } from "@/components/labels/LabelPreview";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest, downloadFile } from "@/lib/api";

interface BookCopyItem {
  id: number;
  copyCode: string;
  barcodeValue: string;
  status: string;
}

interface LabelBook {
  id: number;
  title?: string;
  authors: string[];
  accessionCode: string;
  publicCode: string;
  dateAdded: string;
  copies?: BookCopyItem[];
}

export const PrintLabelsPage = () => {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
    queryKey: ["books", "labels", "copy-aware"],
    queryFn: () =>
      apiRequest<{ items: LabelBook[] }>("/api/books", {
        params: { includeArchived: 0, includeCopies: 1, limit: 400, sort: "title" }
      })
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

  const allLabelItems = useMemo<LabelItem[]>(
    () =>
      books.flatMap((book) => {
        const copies = book.copies ?? [];
        if (copies.length === 0) {
          const fallbackCopyCode = `${book.accessionCode}-C01`;
          return [
            {
              id: `${book.id}-fallback`,
              bookId: book.id,
              accessionCode: book.accessionCode,
              publicCode: book.publicCode,
              title: book.title,
              authors: book.authors ?? [],
              dateAdded: book.dateAdded,
              copyCode: fallbackCopyCode,
              barcodeValue: fallbackCopyCode
            }
          ];
        }

        return copies.map((copy) => ({
          id: `${book.id}-${copy.id}`,
          bookId: book.id,
          accessionCode: book.accessionCode,
          publicCode: book.publicCode,
          title: book.title,
          authors: book.authors ?? [],
          dateAdded: book.dateAdded,
          copyCode: copy.copyCode,
          barcodeValue: copy.barcodeValue || copy.copyCode
        }));
      }),
    [books]
  );

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    if (!keyword) return allLabelItems;
    return allLabelItems.filter((item) =>
      [item.title, item.accessionCode, item.publicCode, item.copyCode, ...item.authors].join(" ").toLowerCase().includes(keyword)
    );
  }, [allLabelItems, search]);

  const selectedItems = allLabelItems.filter((item) => selectedIds.includes(item.id));

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Print Barcodes and Labels</h2>
        <p className="text-sm text-app-muted">Generate printable label sheets for selected book copies.</p>
      </header>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, accession, copy code, author"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-white">
            Print ({selectedItems.length})
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => downloadFile("/api/export/books.csv")} className="rounded-lg border border-app-border px-3 py-2 text-sm">
              Export Books CSV
            </button>
            <button type="button" onClick={() => downloadFile("/api/export/loans.csv")} className="rounded-lg border border-app-border px-3 py-2 text-sm">
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
              className="w-14 rounded border border-app-border px-2 py-1"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card print:hidden">
        <h3 className="font-heading text-base">Select Book Copies</h3>
        {filtered.length === 0 ? (
          <EmptyState title="No copies found" />
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <li key={item.id} className="rounded-lg border border-app-border p-2 text-sm">
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)} className="mt-1" />
                  <span>
                    <strong>{item.title || "Untitled"}</strong>
                    <br />
                    <span className="text-xs text-app-muted">
                      {item.copyCode} - {item.authors?.join(", ")}
                    </span>
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
        {selectedItems.map((item) => (
          <div
            key={item.id}
            className="print:break-inside-avoid"
            style={{ minHeight: `${displaySettings.labelHeightMm}mm`, minWidth: `${displaySettings.labelWidthMm}mm` }}
          >
            <LabelPreview
              item={item}
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
