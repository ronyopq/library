export const LoadingState = ({ label = "Loading..." }: { label?: string }) => (
  <div className="rounded-2xl border border-app-border bg-white p-6 text-center text-sm text-app-muted shadow-card">
    {label}
  </div>
);