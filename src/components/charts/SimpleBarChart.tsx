interface DataPoint {
  name: string;
  count: number;
}

export const SimpleBarChart = ({ title, data }: { title: string; data: DataPoint[] }) => {
  const max = Math.max(1, ...data.map((item) => item.count));

  return (
    <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
      <h3 className="font-heading text-base text-app-text">{title}</h3>
      <div className="mt-3 space-y-2">
        {data.length === 0 ? (
          <p className="text-sm text-app-muted">No data</p>
        ) : (
          data.map((item) => (
            <div key={item.name} className="grid grid-cols-[100px_1fr_30px] items-center gap-2 text-xs">
              <span className="truncate text-app-muted">{item.name}</span>
              <div className="h-2 rounded-full bg-app-surface">
                <div className="h-2 rounded-full bg-app-primary" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
              <span className="text-right font-medium text-app-text">{item.count}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
