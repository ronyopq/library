import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AuthUser } from "@shared/types";
import { activateAdminSession } from "@/lib/adminAuth";
import { apiRequest } from "@/lib/api";

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  return (
    <div className="min-h-screen bg-app-bg px-4 py-10 text-app-text">
      <div className="mx-auto max-w-md rounded-3xl border border-app-border bg-white p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.15em] text-app-muted">Admin Access</p>
        <h1 className="mt-2 font-heading text-3xl">Staff Login</h1>
        <p className="mt-2 text-sm text-app-muted">
          Login with username and password. Admin and librarian accounts can access the panel.
        </p>

        <label className="mt-5 block text-sm">
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter username"
            className="mt-2 w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 block text-sm">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            className="mt-2 w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm"
          />
        </label>

        {errorMessage ? <p className="mt-3 text-sm text-rose-700">{errorMessage}</p> : null}

        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            setErrorMessage("");
            try {
              const result = await apiRequest<{
                token: string;
                user: AuthUser;
                expiresAt: string;
              }>("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({
                  username,
                  password
                })
              });

              activateAdminSession(result.token, result.user);
              navigate("/admin/dashboard");
            } catch (error) {
              setErrorMessage((error as Error).message || "Login failed.");
            } finally {
              setLoading(false);
            }
          }}
          className="mt-4 w-full rounded-xl bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-app-primary-strong"
        >
          {loading ? "Signing in..." : "Continue to Admin"}
        </button>

        <a href="/" className="mt-3 inline-block text-sm text-app-muted underline">
          Back to Public Catalog
        </a>
      </div>
    </div>
  );
};
