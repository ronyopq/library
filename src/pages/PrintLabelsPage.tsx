import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LabelPreview, type LabelItem } from "@/components/labels/LabelPreview";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { Pagination } from "@/components/common/Pagination";
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

type PaperSize = "A4" | "Letter" | "Custom";

const PAGE_SIZE = 50;

export const PrintLabelsPage = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
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

  useEffect(() => {
    setPage(1);
  }, [search]);

  const booksQuery = useQuery({
    queryKey: ["books", "barcode-print", "copy-aware"],
    queryFn: () =>
      apiRequest<{ items: LabelBook[] }>("/api/books", {
        params: { includeArchived: 0, includeCopies: 1, limit: 200, sort: "title", offset: 0 }
      }),
    placeholderData: (previousData) => previousData
  });

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<{ settings: any }>("/api/settings")
  });

  if ((!booksQuery.data && booksQuery.isLoading) || settingsQuery.isLoading) return <LoadingState />;
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
          const fallbackCopyCode = `${book.accessionCode}-01`;
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

  const pagedItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedItems = allLabelItems.filter((item) => selectedIds.includes(item.id));

  const expandedPrintItems = useMemo(
    () =>
      selectedItems.flatMap((item) => {
        const quantity = Math.max(1, Number(quantityMap[item.id] ?? 1));
        return Array.from({ length: quantity }).map((_, index) => ({
          ...item,
          id: `${item.id}-print-${index + 1}`
        }));
      }),
    [selectedItems, quantityMap]
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      if (!prev.includes(id)) {
        setQuantityMap((quantityPrev) => ({ ...quantityPrev, [id]: quantityPrev[id] ?? 1 }));
      }
      return next;
    });
  };

  const pageCss =
    paperSize === "Custom" ? "" : `@media print { @page { size: ${paperSize}; margin: 8mm; } body { margin: 0; } }`;

  return (
    <div className="space-y-4">
      {pageCss ? <style>{pageCss}</style> : null}
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Barcode Print Menu</h2>
        <p className="text-sm text-app-muted">Standard label workflow: search copies, choose quantity, set paper standard, preview, and print.</p>
      </header>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, author, accession, public code, copy code"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-white">
            Print ({expandedPrintItems.length})
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => downloadFile("/api/export/books.csv")} className="rounded-lg border border-app-border px-3 py-2 text-sm">
              Export Books CSV
            </button>
            <button type="button" onClick={() => downloadFile("/api/export/loans.csv")} className="rounded-lg border border-app-border px-3 py-2 text-sm">
              Export Borrow CSV
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="inline-flex items-center gap-2 text-sm">
            Paper Size
            <select
              value={paperSize}
              onChange={(event) => setPaperSize(event.target.value as PaperSize)}
              className="rounded-lg border border-app-border px-2 py-1"
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Custom">Custom</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() =>
              setOverrideOptions({
                labelIncludeTitle: true,
                labelIncludeAuthor: true,
                labelIncludeDate: false,
                labelIncludeQr: true,
                labelColumns: 3,
                labelWidthMm: 50,
                labelHeightMm: 30
              })
            }
            className="rounded-lg border border-app-border px-3 py-2 text-sm"
          >
            Apply Standard Label
          </button>

          <p className="text-sm text-app-muted">
            Selected: <strong>{selectedIds.length}</strong> copies
          </p>
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
              onChange={(event) => setOverrideOptions((prev) => ({ ...prev, labelColumns: Number(event.target.value) }))}
              className="w-14 rounded border border-app-border px-2 py-1"
            />
          </label>

          <label className="inline-flex items-center gap-2">
            W (mm)
            <input
              type="number"
              min={20}
              max={120}
              value={displaySettings.labelWidthMm}
              onChange={(event) => setOverrideOptions((prev) => ({ ...prev, labelWidthMm: Number(event.target.value) }))}
              className="w-16 rounded border border-app-border px-2 py-1"
            />
          </label>
          <label className="inline-flex items-center gap-2">
            H (mm)
            <input
              type="number"
              min={15}
              max={120}
              value={displaySettings.labelHeightMm}
              onChange={(event) => setOverrideOptions((prev) => ({ ...prev, labelHeightMm: Number(event.target.value) }))}
              className="w-16 rounded border border-app-border px-2 py-1"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card print:hidden">
        <h3 className="font-heading text-base">Step 1: Choose Book Copies</h3>
        {filtered.length === 0 ? (
          <EmptyState title="No copies found" />
        ) : (
          <div className="space-y-3">
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {pagedItems.map((item) => (
                <li key={item.id} className="rounded-lg border border-app-border p-2 text-sm">
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <strong>{item.title || "Untitled"}</strong>
                      <p className="text-xs text-app-muted">
                        {item.copyCode} | {item.publicCode}
                      </p>
                      <p className="text-xs text-app-muted">{item.authors?.join(", ") || "Unknown author"}</p>
                      <label className="mt-2 inline-flex items-center gap-2 text-xs text-app-muted">
                        Quantity
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={quantityMap[item.id] ?? 1}
                          onChange={(event) =>
                            setQuantityMap((prev) => ({
                              ...prev,
                              [item.id]: Math.max(1, Number(event.target.value || 1))
                            }))
                          }
                          className="w-16 rounded border border-app-border px-2 py-1"
                        />
                      </label>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} isBusy={booksQuery.isFetching} />
          </div>
        )}
      </section>

      <section
        className="label-grid grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${displaySettings.labelColumns}, minmax(0, 1fr))`
        }}
      >
        {expandedPrintItems.map((item) => (
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
