import { Link } from "react-router-dom";

export const NotFoundPage = () => (
  <div className="rounded-2xl border border-brand-200 bg-white p-8 text-center shadow-soft">
    <h2 className="font-heading text-2xl">?????? ????? ?????</h2>
    <p className="mt-2 text-sm text-ink-500">????? ????? ????? ????</p>
    <Link to="/" className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
      Go Dashboard
    </Link>
  </div>
);