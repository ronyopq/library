import type { LibraryOptions } from "@shared/types";

export interface LibraryFilters {
  search: string;
  category: string;
  author: string;
  language: string;
  status: string;
  location: string;
  sort: "recent" | "title" | "author" | "publicationYear";
}

interface BookFiltersProps {
  filters: LibraryFilters;
  options?: LibraryOptions;
  onChange: (next: LibraryFilters) => void;
}

const selectClass = "rounded-xl border border-app-border bg-white px-3 py-2 text-sm text-app-text";

export const BookFilters = ({ filters, options, onChange }: BookFiltersProps) => {
  const update = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => {
    onChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <section className="space-y-3 rounded-2xl border border-app-border bg-white p-4 shadow-card">
      <input
        value={filters.search}
        onChange={(event) => update("search", event.target.value)}
        placeholder="Search title, author, code..."
        className="w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <select value={filters.category} onChange={(event) => update("category", event.target.value)} className={selectClass}>
          <option value="">All categories</option>
          {options?.categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select value={filters.author} onChange={(event) => update("author", event.target.value)} className={selectClass}>
          <option value="">All authors</option>
          {options?.authors.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select value={filters.language} onChange={(event) => update("language", event.target.value)} className={selectClass}>
          <option value="">All languages</option>
          {options?.languages.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select value={filters.status} onChange={(event) => update("status", event.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="borrowed">Borrowed</option>
          <option value="lost">Lost</option>
        </select>

        <input
          value={filters.location}
          onChange={(event) => update("location", event.target.value)}
          placeholder="Location"
          className={selectClass}
        />

        <select value={filters.sort} onChange={(event) => update("sort", event.target.value as LibraryFilters["sort"])} className={selectClass}>
          <option value="recent">Recently Added</option>
          <option value="title">Title</option>
          <option value="author">Author</option>
          <option value="publicationYear">Publication Year</option>
        </select>
      </div>
    </section>
  );
};