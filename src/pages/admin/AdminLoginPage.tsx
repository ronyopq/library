import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { activateAdminSession, getStoredAdminToken } from "@/lib/adminAuth";

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState(getStoredAdminToken());

  return (
    <div className="min-h-screen bg-app-bg px-4 py-10 text-app-text">
      <div className="mx-auto max-w-md rounded-3xl border border-app-border bg-white p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.15em] text-app-muted">Admin Access</p>
        <h1 className="mt-2 font-heading text-3xl">Library Admin</h1>
        <p className="mt-2 text-sm text-app-muted">
          Enter your admin token to manage books, archive entries, and handle lending workflows.
        </p>

        <label className="mt-5 block text-sm">
          Admin Token
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste ADMIN_TOKEN"
            className="mt-2 w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            activateAdminSession(token);
            navigate("/admin/dashboard");
          }}
          className="mt-4 w-full rounded-xl bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-app-primary-strong"
        >
          Continue to Admin
        </button>

        <a href="/" className="mt-3 inline-block text-sm text-app-muted underline">
          Back to Public Catalog
        </a>
      </div>
    </div>
  );
};