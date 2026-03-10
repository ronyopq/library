export const EmptyState = ({ title, description }: { title: string; description?: string }) => (
  <div className="rounded-2xl border border-dashed border-app-border bg-app-surface p-8 text-center">
    <h3 className="font-heading text-lg text-app-text">{title}</h3>
    {description ? <p className="mt-2 text-sm text-app-muted">{description}</p> : null}
  </div>
);