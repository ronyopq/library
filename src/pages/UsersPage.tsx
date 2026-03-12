import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser, StaffRole } from "@shared/types";
import { useNavigate } from "react-router-dom";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { getStoredAuthUser, updateStoredAuthUser } from "@/lib/adminAuth";
import { apiRequest } from "@/lib/api";
import { appAlert, appConfirm } from "@/lib/appDialog";

interface CreateUserForm {
  username: string;
  password: string;
  fullName: string;
  phone: string;
  role: StaffRole;
}

interface EditUserForm {
  username: string;
  fullName: string;
  phone: string;
  role: StaffRole;
  password: string;
  showPassword: boolean;
}

const defaultCreateForm: CreateUserForm = {
  username: "",
  password: "",
  fullName: "",
  phone: "",
  role: "librarian"
};

const createEditForm = (user: AuthUser): EditUserForm => ({
  username: user.username,
  fullName: user.fullName ?? "",
  phone: user.phone ?? "",
  role: user.role,
  password: "",
  showPassword: false
});

export const UsersPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = getStoredAuthUser();
  const [createForm, setCreateForm] = useState<CreateUserForm>(defaultCreateForm);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [userForms, setUserForms] = useState<Record<number, EditUserForm>>({});

  const usersQuery = useQuery({
    queryKey: ["staff-users"],
    queryFn: () => apiRequest<{ users: AuthUser[] }>("/api/users")
  });

  const users = usersQuery.data?.users ?? [];

  useEffect(() => {
    if (!users.length) {
      setUserForms({});
      return;
    }

    const nextForms: Record<number, EditUserForm> = {};
    for (const user of users) {
      nextForms[user.id] = createEditForm(user);
    }
    setUserForms(nextForms);
  }, [users]);

  const refreshUsers = async () => {
    await queryClient.invalidateQueries({ queryKey: ["staff-users"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserForm) =>
      apiRequest<{ user: AuthUser }>("/api/users", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async (_, variables) => {
      setCreateForm(defaultCreateForm);
      setShowCreatePassword(false);
      await refreshUsers();
      appAlert(`Staff user created successfully.\nUsername: ${variables.username}\nPassword: ${variables.password}`, "User Created");
    },
    onError: (error) => {
      appAlert((error as Error).message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: Omit<EditUserForm, "password" | "showPassword"> }) =>
      apiRequest<{ user: AuthUser }>(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: async ({ user }) => {
      if (currentUser?.id === user.id) {
        updateStoredAuthUser(user);
        if (user.role !== "admin") {
          navigate("/admin/dashboard", { replace: true });
        }
      }
      await refreshUsers();
      appAlert("User details updated.");
    },
    onError: (error) => {
      appAlert((error as Error).message);
    }
  });

  const passwordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      apiRequest<{ ok: true }>(`/api/users/${userId}/password`, {
        method: "POST",
        body: JSON.stringify({ password })
      }),
    onSuccess: async (_, variables) => {
      setUserForms((prev) => ({
        ...prev,
        [variables.userId]: {
          ...(prev[variables.userId] ?? {
            username: "",
            fullName: "",
            phone: "",
            role: "librarian" as StaffRole,
            showPassword: false
          }),
          password: "",
          showPassword: false
        }
      }));
      await refreshUsers();
      appAlert(`Password updated successfully.\nNew Password: ${variables.password}`, "Password Updated");
    },
    onError: (error) => {
      appAlert((error as Error).message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) =>
      apiRequest<{ ok: true }>(`/api/users/${userId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await refreshUsers();
      appAlert("User deleted successfully.");
    },
    onError: (error) => {
      appAlert((error as Error).message);
    }
  });

  const updateUserField = <K extends keyof EditUserForm>(userId: number, field: K, value: EditUserForm[K]) => {
    setUserForms((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] ?? createEditForm(users.find((item) => item.id === userId) as AuthUser)),
        [field]: value
      }
    }));
  };

  const handleCreate = () => {
    createMutation.mutate(createForm);
  };

  const handleUpdate = (userId: number) => {
    const form = userForms[userId];
    if (!form) return;

    updateMutation.mutate({
      userId,
      payload: {
        username: form.username,
        fullName: form.fullName,
        phone: form.phone,
        role: form.role
      }
    });
  };

  const handlePasswordReset = (userId: number) => {
    const form = userForms[userId];
    if (!form?.password.trim()) {
      appAlert("Enter a new password first.");
      return;
    }

    passwordMutation.mutate({
      userId,
      password: form.password
    });
  };

  const handleDelete = async (userId: number, username: string) => {
    const confirmed = await appConfirm(
      `Delete user "${username}"? This will immediately disable the account and sign out any active sessions.`,
      "Delete Staff User"
    );

    if (!confirmed) return;
    deleteMutation.mutate(userId);
  };

  if (usersQuery.isLoading) return <LoadingState />;
  if (usersQuery.isError) return <ErrorState message={(usersQuery.error as Error).message} retry={() => usersQuery.refetch()} />;

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Staff Accounts</h2>
        <p className="text-sm text-app-muted">
          Admin can create, edit, reset passwords, and delete staff accounts from this page.
        </p>
        <p className="mt-2 text-xs text-app-muted">
          Current passwords cannot be displayed because they are stored securely. You can set and reveal a new password here.
        </p>
      </header>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Create New Staff User</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={createForm.username}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))}
            placeholder="Username"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={createForm.password}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Password"
              type={showCreatePassword ? "text" : "password"}
              className="rounded-xl border border-app-border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowCreatePassword((prev) => !prev)}
              className="rounded-xl border border-app-border px-3 py-2 text-xs"
            >
              {showCreatePassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            value={createForm.fullName}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, fullName: event.target.value }))}
            placeholder="Full Name"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <input
            value={createForm.phone}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
            placeholder="Phone"
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          />
          <select
            value={createForm.role}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value as StaffRole }))}
            className="rounded-xl border border-app-border px-3 py-2 text-sm"
          >
            <option value="librarian">Librarian</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="mt-4 rounded-xl bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-app-primary-strong disabled:opacity-60"
        >
          {createMutation.isPending ? "Creating..." : "Create User"}
        </button>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-base">Manage Existing Staff</h3>
          <span className="text-xs text-app-muted">{users.length} active user(s)</span>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {users.map((user) => {
            const form = userForms[user.id] ?? createEditForm(user);
            const isCurrentUser = currentUser?.id === user.id;

            return (
              <article key={user.id} className="rounded-2xl border border-app-border bg-app-surface/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-heading text-lg text-app-text">{user.username}</h4>
                    <p className="text-xs text-app-muted">
                      {isCurrentUser ? "Current signed-in account" : "Staff account"} · <span className="capitalize">{user.role}</span>
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      user.role === "admin" ? "bg-fuchsia-100 text-fuchsia-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    value={form.username}
                    onChange={(event) => updateUserField(user.id, "username", event.target.value)}
                    placeholder="Username"
                    className="rounded-xl border border-app-border bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={form.fullName}
                    onChange={(event) => updateUserField(user.id, "fullName", event.target.value)}
                    placeholder="Full Name"
                    className="rounded-xl border border-app-border bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={form.phone}
                    onChange={(event) => updateUserField(user.id, "phone", event.target.value)}
                    placeholder="Phone"
                    className="rounded-xl border border-app-border bg-white px-3 py-2 text-sm"
                  />
                  <select
                    value={form.role}
                    onChange={(event) => updateUserField(user.id, "role", event.target.value as StaffRole)}
                    className="rounded-xl border border-app-border bg-white px-3 py-2 text-sm"
                  >
                    <option value="librarian">Librarian</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="mt-4 rounded-xl border border-app-border bg-white p-3">
                  <p className="text-xs text-app-muted">Set New Password</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                    <input
                      value={form.password}
                      onChange={(event) => updateUserField(user.id, "password", event.target.value)}
                      placeholder="Enter new password"
                      type={form.showPassword ? "text" : "password"}
                      className="rounded-xl border border-app-border px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => updateUserField(user.id, "showPassword", !form.showPassword)}
                      className="rounded-xl border border-app-border px-3 py-2 text-xs"
                    >
                      {form.showPassword ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePasswordReset(user.id)}
                      disabled={passwordMutation.isPending}
                      className="rounded-xl bg-app-primary px-3 py-2 text-sm font-medium text-white hover:bg-app-primary-strong disabled:opacity-60"
                    >
                      {passwordMutation.isPending ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate(user.id)}
                    disabled={updateMutation.isPending}
                    className="rounded-xl border border-app-border px-4 py-2 text-sm hover:bg-white disabled:opacity-60"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(user.id, user.username)}
                    disabled={deleteMutation.isPending || isCurrentUser}
                    className="rounded-xl border border-rose-300 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title={isCurrentUser ? "You cannot delete your own account while signed in." : "Delete user"}
                  >
                    {deleteMutation.isPending ? "Deleting..." : isCurrentUser ? "Current User" : "Delete User"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
