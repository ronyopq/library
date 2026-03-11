import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { apiRequest } from "@/lib/api";
import { getStoredAuthUser, isCurrentUserAdmin } from "@/lib/adminAuth";

interface SettingsForm {
  libraryName: string;
  publicBaseUrl: string;
  dateFormat: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  defaultLanguage: string;
  defaultCategory: string;
  publicVisibilityMode: "selected" | "all" | "off";
  labelIncludeTitle: boolean;
  labelIncludeAuthor: boolean;
  labelIncludeDate: boolean;
  labelIncludeQr: boolean;
  labelColumns: number;
  labelWidthMm: number;
  labelHeightMm: number;
}

export const SettingsPage = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsForm | null>(null);
  const currentUser = getStoredAuthUser();
  const canManageUsers = isCurrentUserAdmin();

  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<{ settings: SettingsForm }>("/api/settings")
  });

  useEffect(() => {
    if (query.data?.settings) {
      setForm(query.data.settings);
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: SettingsForm) =>
      apiRequest<{ settings: SettingsForm }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: (result) => {
      setForm(result.settings);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => {
      alert((error as Error).message);
    }
  });

  if (query.isLoading || !form) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} retry={() => query.refetch()} />;

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h2 className="font-heading text-xl">Library Settings</h2>
        <p className="text-sm text-app-muted">Branding, public URL, print preferences, and privacy defaults.</p>
      </header>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">General</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input value={form.libraryName} onChange={(event) => update("libraryName", event.target.value)} placeholder="Library Name" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.publicBaseUrl ?? ""} onChange={(event) => update("publicBaseUrl", event.target.value)} placeholder="Public Base URL" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.dateFormat} onChange={(event) => update("dateFormat", event.target.value)} placeholder="Date Format" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <select value={form.publicVisibilityMode} onChange={(event) => update("publicVisibilityMode", event.target.value as SettingsForm["publicVisibilityMode"])} className="rounded-xl border border-app-border px-3 py-2 text-sm">
            <option value="selected">Selected books only</option>
            <option value="all">All books public by default</option>
            <option value="off">Public pages off by default</option>
          </select>
          <input value={form.contactName ?? ""} onChange={(event) => update("contactName", event.target.value)} placeholder="Contact Name" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.contactPhone ?? ""} onChange={(event) => update("contactPhone", event.target.value)} placeholder="Contact Phone" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.contactEmail ?? ""} onChange={(event) => update("contactEmail", event.target.value)} placeholder="Contact Email" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.defaultLanguage ?? ""} onChange={(event) => update("defaultLanguage", event.target.value)} placeholder="Default Language" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input value={form.defaultCategory ?? ""} onChange={(event) => update("defaultCategory", event.target.value)} placeholder="Default Category" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Print Labels</h3>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {[
            ["labelIncludeTitle", "Include Title"],
            ["labelIncludeAuthor", "Include Author"],
            ["labelIncludeDate", "Include Date"],
            ["labelIncludeQr", "Include QR"]
          ].map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-2">
              <input type="checkbox" checked={Boolean((form as any)[key])} onChange={(event) => update(key as keyof SettingsForm, event.target.checked as never)} />
              {label}
            </label>
          ))}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input type="number" value={form.labelColumns} onChange={(event) => update("labelColumns", Number(event.target.value))} placeholder="Columns" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input type="number" value={form.labelWidthMm} onChange={(event) => update("labelWidthMm", Number(event.target.value))} placeholder="Width (mm)" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
          <input type="number" value={form.labelHeightMm} onChange={(event) => update("labelHeightMm", Number(event.target.value))} placeholder="Height (mm)" className="rounded-xl border border-app-border px-3 py-2 text-sm" />
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-white p-4 shadow-card">
        <h3 className="font-heading text-base">Current Staff Session</h3>
        <p className="mt-2 text-sm text-app-muted">
          Signed in as <strong>{currentUser?.username ?? "unknown"}</strong> ({currentUser?.role ?? "staff"}).
        </p>
        {canManageUsers ? (
          <a href="/admin/users" className="mt-3 inline-block rounded-lg border border-app-border px-3 py-2 text-sm hover:bg-app-surface">
            Manage Staff Users
          </a>
        ) : null}
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {mutation.isPending ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};
