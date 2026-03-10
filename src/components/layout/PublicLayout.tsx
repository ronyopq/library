import { Outlet } from "react-router-dom";

export const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <header className="border-b border-app-border bg-white/95">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 md:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-app-muted">Public Catalog</p>
            <h1 className="font-heading text-2xl">Personal Library</h1>
          </div>
          <a
            href="/admin/login"
            className="rounded-xl bg-app-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-app-primary-strong"
          >
            Admin Login
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
        <Outlet />
      </main>
    </div>
  );
};