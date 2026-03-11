interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  isBusy?: boolean;
}

export const Pagination = ({ page, pageSize, total, onPageChange, isBusy = false }: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app-border bg-white px-3 py-2 text-sm">
      <p className="text-app-muted">
        Showing <strong>{start}</strong>-<strong>{end}</strong> of <strong>{total}</strong>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1 || isBusy}
          className="rounded-lg border border-app-border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <p className="text-app-muted">
          Page <strong>{safePage}</strong> / <strong>{totalPages}</strong>
        </p>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages || isBusy}
          className="rounded-lg border border-app-border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

