import type { DuplicateMatch } from "@shared/types";

export const DuplicateWarning = ({
  duplicates,
  onForceSave
}: {
  duplicates: DuplicateMatch[];
  onForceSave: () => void;
}) => {
  if (duplicates.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-heading text-base text-amber-900">Possible duplicate books detected</h3>
      <p className="mt-1 text-sm text-amber-800">You can continue and save this as a separate copy if intentional.</p>
      <ul className="mt-3 space-y-2 text-sm">
        {duplicates.map((item) => (
          <li key={item.id} className="rounded-lg border border-amber-200 bg-white p-3">
            <p className="font-medium text-app-text">{item.title || "Untitled"}</p>
            <p className="text-xs text-app-muted">
              {item.accessionCode} | {item.publicCode} | {item.authors.join(", ")}
            </p>
            <p className="mt-1 text-xs text-amber-700">{item.reason} (score: {item.score.toFixed(2)})</p>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onForceSave}
        className="mt-3 rounded-lg border border-amber-400 bg-amber-100 px-3 py-2 text-sm text-amber-900 hover:bg-amber-200"
      >
        Save Anyway
      </button>
    </section>
  );
};