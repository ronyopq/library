import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser, StaffRole } from "@shared/types";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { appAlert } from "@/lib/appDialog";

interface CreateUserForm {
  username: string;
  password: string;
  fullName: string;
  phone: string;
  role: StaffRole;
}

const defaultForm: CreateUserForm = {
  username: "",
  password: "",
  fullName: "",
  phone: "",
  role: "librarian"
};

export const UsersPage = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateUserForm>(defaultForm);

  const usersQuery = useQuery({
    queryKey: ["staff-users"],
    queryFn: () => apiRequest<{ users: AuthUser[] }>("/api/users")
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserForm) =>
      apiRequest<{ user: AuthUser }>("/api/users", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
    },
    onError: (error) => {
      appAlert((error as Error).message);
    }
  });

  if (usersQuery.isLoading) return <LoadingState />;
  if (usersQuery.isError) return <ErrorState message={(usersQuery.error as Error).message} retry={() => usersQuery.refetch()} />;

  const users = usersQuery.data?.users ?? [];

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Staff Accounts</h2>
        <p className="text-sm text-app-muted">Admin can create login IDs for admin or librarian roles.</p>
      </header>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Create New Staff User</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            placeholder="Username"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <input
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Password"
            type="password"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <input
            value={form.fullName}
            onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
            placeholder="Full Name"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <input
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            placeholder="Phone"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <select
            value={form.role}
            onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as StaffRole }))}
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          >
            <option value="librarian">Librarian</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => createMutation.mutate(form)}
          disabled={createMutation.isPending}
          className="mt-4 rounded-xl bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-app-primary-strong disabled:opacity-60"
        >
          {createMutation.isPending ? "Creating..." : "Create User"}
        </button>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Existing Staff</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-app-border text-left text-app-muted">
                <th className="px-2 py-2">Username</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-app-border/60">
                  <td className="px-2 py-2">{user.username}</td>
                  <td className="px-2 py-2">{user.fullName || "-"}</td>
                  <td className="px-2 py-2">{user.phone || "-"}</td>
                  <td className="px-2 py-2 capitalize">{user.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
