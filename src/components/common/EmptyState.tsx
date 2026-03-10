export const EmptyState = ({ title, description }: { title: string; description?: string }) => (
  <div className="rounded-2xl border border-dashed border-brand-300 bg-brand-50 p-8 text-center">
    <h3 className="font-heading text-lg text-ink-900">{title}</h3>
    {description ? <p className="mt-2 text-sm text-ink-500">{description}</p> : null}
  </div>
);