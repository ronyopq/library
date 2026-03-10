import { Link } from "react-router-dom";

export const NotFoundPage = () => (
  <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-app-border bg-white p-8 text-center shadow-card">
    <h2 className="font-heading text-2xl">Page not found</h2>
    <p className="mt-2 text-sm text-app-muted">The route you requested does not exist.</p>
    <Link to="/" className="mt-4 inline-flex rounded-lg bg-app-primary px-4 py-2 text-sm text-white">
      Go to Public Catalog
    </Link>
  </div>
);