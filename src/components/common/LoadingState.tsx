export const LoadingState = ({ label = "??? ?????..." }: { label?: string }) => (
  <div className="rounded-2xl border border-emerald-100 bg-white/80 p-6 text-center text-sm text-ink-500 shadow-soft">
    {label}
  </div>
);